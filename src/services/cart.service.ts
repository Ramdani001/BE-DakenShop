import prisma from "../../prisma/prisma";

export class CartService {
    async getCartByUserId(userId: string) {
        let cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            include: { types: true },
                        },
                        productType: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId },
                include: {
                    items: {
                        include: {
                            product: { include: { types: true } },
                            productType: true,
                        },
                    },
                },
            });
        }

        const totalPrice = cart.items.reduce((sum: number, item: any) => {
            const productPrice = item.product?.types?.[0]?.price ? Number(item.product.types[0].price) : 0;
            return sum + productPrice * item.quantity;
        }, 0);

        const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

        return {
            ...cart,
            summary: {
                totalItems,
                totalPrice,
            },
        };
    }

    async addToCart(userId: string, data: { productId: string; productTypeId: string; quantity: number }) {
        const cartWrapper = await this.getCartByUserId(userId);
        const cartId = cartWrapper.id;

        const existingItem = await prisma.cartItem.findFirst({
            where: {
                cartId: cartId,
                productId: data.productId,
                typeId: data.productTypeId,
            },
        });

        if (existingItem) {
            return await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: {
                    quantity: existingItem.quantity + data.quantity,
                },
            });
        }

        return await prisma.cartItem.create({
            data: {
                cartId: cartId,
                productId: data.productId,
                typeId: data.productTypeId,
                quantity: data.quantity,
            },
        });
    }

    async updateQuantity(cartItemId: string, quantity: number) {
        if (quantity <= 0) {
            return await this.removeItem(cartItemId);
        }

        const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
        if (!item) throw new Error(`Cart item with ID ${cartItemId} not found.`);
        
        return item;

        // return await prisma.cartItem.update({
        //     where: { id: cartItemId },
        //     data: { quantity },
        // });
    }

    async removeItem(cartItemId: string) {
        const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
        if (!item) throw new Error(`Cart item with ID ${cartItemId} not found.`);

        return await prisma.cartItem.delete({
            where: { id: cartItemId },
        });
    }

    async clearCart(userId: string) {
        const cartWrapper = await this.getCartByUserId(userId);

        return await prisma.cartItem.deleteMany({
            where: { cartId: cartWrapper.id },
        });
    }
}
