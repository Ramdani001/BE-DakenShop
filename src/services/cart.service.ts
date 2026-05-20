import prisma from "../../prisma/prisma";

export class CartService {
    // 1. MENGAMBIL DATA KERANJANG BERDASARKAN USER ID
    async getCartByUserId(userId: string) {
        // @ts-ignore
        let cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            // PERBAIKAN 1: Wajib sertakan 'types' karena nominal 'price' ada di sana
                            include: { types: true } 
                        }, 
                    },
                    orderBy: { createdAt: "asc" }, 
                },
            },
        });

        // JIKA KERANJANG BELUM ADA DI DB, OTOMATIS BUAT BARU
        if (!cart) {
            // @ts-ignore
            cart = await prisma.cart.create({
                data: { userId },
                include: {
                    items: {
                        include: {
                            product: { include: { types: true } }
                        },
                    },
                },
            });
        }

        // PERBAIKAN 2: Ambil harga varian pertama (indeks 0) dari array types agar tidak NaN/Crash
        const totalPrice = cart.items.reduce((sum: number, item: any) => {
            const productPrice = item.product?.types?.[0]?.price ? Number(item.product.types[0].price) : 0;
            return sum + (productPrice * item.quantity);
        }, 0);

        const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

        return {
            ...cart,
            summary: {
                totalItems,
                totalPrice,
            }
        };
    }

    // 2. MENAMBAH ITEM KE DALAM KERANJANG
    async addToCart(userId: string, data: { productId: string; quantity: number }) {
        const cartWrapper = await this.getCartByUserId(userId);
        const cartId = cartWrapper.id;

        // @ts-ignore
        const existingItem = await prisma.cartItem.findFirst({
            where: {
                cartId: cartId,
                productId: data.productId,
            },
        });

        if (existingItem) {
            // @ts-ignore
            return await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: {
                    quantity: existingItem.quantity + data.quantity,
                },
            });
        }

        // @ts-ignore
        return await prisma.cartItem.create({
            data: {
                cartId: cartId,
                productId: data.productId,
                quantity: data.quantity,
            },
        });
    }

    // 3. MEMPERBARUI JUMLAH (QUANTITY) SECARA LANGSUNG
    async updateQuantity(cartItemId: string, quantity: number) {
        if (quantity <= 0) {
            return await this.removeItem(cartItemId);
        }

        // @ts-ignore
        const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
        if (!item) throw new Error(`Cart item with ID ${cartItemId} not found.`);

        // @ts-ignore
        return await prisma.cartItem.update({
            where: { id: cartItemId },
            data: { quantity },
        });
    }

    // 4. MENGHAPUS SATU ITEM DARI KERANJANG
    async removeItem(cartItemId: string) {
        // @ts-ignore
        const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
        if (!item) throw new Error(`Cart item with ID ${cartItemId} not found.`);

        // @ts-ignore
        return await prisma.cartItem.delete({
            where: { id: cartItemId },
        });
    }

    // 5. BERSIHKAN SELURUH ISI KERANJANG
    async clearCart(userId: string) {
        const cartWrapper = await this.getCartByUserId(userId);
        
        // @ts-ignore
        return await prisma.cartItem.deleteMany({
            where: { cartId: cartWrapper.id },
        });
    }
}