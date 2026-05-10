import prisma from "../../prisma/prisma";

export class OrderService {
    async createOrder(data: any) {
        const { customerName, customerEmail, customerPhone, address, cartItems } = data;

        let totalAmount = 0;
        const itemsToCreate = [];

        for (const item of cartItems) {
            const productType = await prisma.productType.findUnique({
                where: { id: item.productTypeId },
                include: { product: true },
            });

            if (!productType) throw new Error(`Product type ${item.productTypeId} not found`);

            const itemPrice = Number(productType.price);
            const subTotal = itemPrice * item.quantity;
            totalAmount += subTotal;

            itemsToCreate.push({
                productId: productType.productId,
                productName: productType.product.name,
                productType: productType.type,
                price: itemPrice,
                quantity: item.quantity,
            });
        }

        return await prisma.order.create({
            data: {
                customerName,
                customerEmail,
                customerPhone,
                address,
                totalAmount,
                items: {
                    create: itemsToCreate,
                },
            },
            include: { items: true },
        });
    }

    async getOrderById(id: string) {
        return await prisma.order.findUnique({
            where: { id },
            include: { items: true },
        });
    }

    async getAll(page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            prisma.order.findMany({
                skip,
                take: limit,
                include: {
                    items: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            prisma.order.count(),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
