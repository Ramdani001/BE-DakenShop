import prisma from "../../prisma/prisma";
import { OrderStatus } from "@prisma/client";
import midtransClient from "midtrans-client";

const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
});

interface UserPayload {
    id: string;
}

export class OrderService {
    async createOrder(data: any, user: UserPayload) {
        const { customerName, customerEmail, customerPhone, address, cartItems } = data;

        let totalAmount = 0;
        const itemsToCreate = [];
        const midtransItems = [];

        for (const item of cartItems) {
            const productType = await prisma.productType.findUnique({
                where: { id: item.typeId },
                include: { product: true },
            });

            if (!productType) throw new Error(`Produk tidak ditemukan atau varian tidak valid`);

            const discountPercentage = Number(productType.product?.discountPercentage || 0);

            let itemPrice = Number(productType.price);
            if (discountPercentage > 0) {
                itemPrice = itemPrice - (discountPercentage / 100) * itemPrice;
            }
            itemPrice = Math.round(itemPrice);

            const subTotal = itemPrice * item.quantity;
            totalAmount += subTotal;

            itemsToCreate.push({
                productId: productType.productId,
                productName: productType.product.name,
                productType: productType.type,
                price: itemPrice,
                quantity: item.quantity,
            });

            midtransItems.push({
                id: productType.id,
                price: itemPrice,
                quantity: item.quantity,
                name: `${productType.product.name} (${productType.type})`.substring(0, 50),
            });
        }

        const orderId = "DS-" + Date.now() + Math.floor(1000 + Math.random() * 9000);

        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: totalAmount,
            },
            item_details: midtransItems,
            customer_details: {
                first_name: customerName,
                email: customerEmail,
                phone: customerPhone,
                billing_address: { address: address },
                shipping_address: { address: address },
            },
            enabled_payments: ["credit_card", "gopay", "shopeepay", "permata_va", "bca_va", "bni_va", "bri_va", "echannel", "cimb_va"],
        };

        const transaction = await snap.createTransaction(parameter);

        return await prisma.order.create({
            data: {
                id: orderId,
                customerName,
                customerEmail,
                customerPhone,
                address,
                totalAmount,
                userId: user.id,
                status: OrderStatus.PENDING_PAYMENT,
                snapToken: transaction.token,
                snapUrl: transaction.redirect_url,
                items: {
                    create: itemsToCreate,
                },
            },
            include: { items: true },
        });
    }

    async createWa(data: any, user: UserPayload) {
        const { address, customerEmail, customerName, customerPhone, orderItems } = data;

        let totalAmount = 0;
        const itemsToCreate = [];

        for (const orderItem of orderItems) {
            const productType = await prisma.productType.findUnique({
                where: { id: orderItem.productTypeId },
                include: { product: true },
            });

            if (!productType) throw new Error(`Produk tidak ditemukan atau varian tidak valid`);

            const discountPercentage = Number(productType.product?.discountPercentage || 0);

            let itemPrice = Number(productType.price);
            if (discountPercentage > 0) {
                itemPrice = itemPrice - (discountPercentage / 100) * itemPrice;
            }
            itemPrice = Math.round(itemPrice);

            const subTotal = itemPrice * orderItem.quantity;
            totalAmount += subTotal;

            itemsToCreate.push({
                productId: productType.productId,
                productName: productType.product.name,
                productType: productType.type,
                price: itemPrice,
                quantity: orderItem.quantity,
            });
        }

        const orderId = "DS-" + Date.now() + Math.floor(1000 + Math.random() * 9000);

        return await prisma.order.create({
            data: {
                id: orderId,
                customerName,
                customerEmail,
                customerPhone,
                address,
                totalAmount,
                userId: user.id,
                status: OrderStatus.PENDING_PAYMENT,
                snapToken: null,
                snapUrl: null,
                items: {
                    create: itemsToCreate,
                },
            },
            include: { items: true },
        });
    }

    async handleNotification(notificationData: any) {
        const statusResponse = await (snap as any).transaction.notification(notificationData);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        let finalStatus: OrderStatus = OrderStatus.PENDING_PAYMENT;

        if (transactionStatus === "capture") {
            if (fraudStatus === "challenge") {
                finalStatus = OrderStatus.PENDING_PAYMENT;
            } else if (fraudStatus === "accept") {
                finalStatus = OrderStatus.WAITING_PROCESS;
            }
        } else if (transactionStatus === "settlement") {
            finalStatus = OrderStatus.WAITING_PROCESS;
        } else if (transactionStatus === "cancel" || transactionStatus === "deny" || transactionStatus === "expire") {
            finalStatus = OrderStatus.CANCELED;
        } else if (transactionStatus === "pending") {
            finalStatus = OrderStatus.PENDING_PAYMENT;
        }

        return await prisma.order.update({
            where: { id: orderId },
            data: {
                status: finalStatus,
            },
        });
    }

    async getOrderById(id: string, user: UserPayload) {
        return await prisma.order.findUnique({
            where: { id, userId: user.id },
            include: { items: true },
        });
    }

    async getAll(page: number = 1, limit: number = 50, user: UserPayload) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            prisma.order.findMany({
                skip,
                take: limit,
                include: { items: true },
                orderBy: { createdAt: "desc" },
                where: { userId: user.id },
            }),
            prisma.order.count({ where: { userId: user.id } }),
        ]);

        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
}
