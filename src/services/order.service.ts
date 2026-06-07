import prisma from "../../prisma/prisma";

import { OrderStatus } from "@prisma/client"; 

const midtransClient = require('midtrans-client');

const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

export class OrderService {
    async createOrder(data: any, user: any) {
        const { customerName, customerEmail, customerPhone, address, cartItems } = data;

        let totalAmount = 0;
        const itemsToCreate = [];
        const midtransItems = [];

        for (const item of cartItems) {
            const productType = await prisma.productType.findUnique({
                where: { id: item.variantId || item.productTypeId },
                include: { product: true },
            });

            if (!productType) throw new Error(`Produk tidak ditemukan atau varian tidak valid`);

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

            midtransItems.push({
                id: productType.id,
                price: itemPrice,
                quantity: item.quantity,
                name: `${productType.product.name} (${productType.type})`.substring(0, 50)
            });
        }

        const orderId = "DS-" + Date.now() + Math.floor(1000 + Math.random() * 9000);

        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: totalAmount
            },
            item_details: midtransItems,
            customer_details: {
                first_name: customerName,
                email: customerEmail,
                phone: customerPhone,
                billing_address: { address: address },
                shipping_address: { address: address }
            },
            enabled_payments: ["credit_card", "gopay", "shopeepay", "permata_va", "bca_va", "bni_va", "bri_va", "echannel", "cimb_va"]
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
                // PERBAIKAN TOTAL: Masukkan objek enum murni tanpa casting string!
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

    async handleNotification(notificationData: any) {
        const statusResponse = await snap.transaction.notification(notificationData);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        // Tentukan tipe variabel secara ketat sesuai skema Enum Prisma
        let finalStatus: OrderStatus = OrderStatus.PENDING_PAYMENT; 

        if (transactionStatus === 'capture') {
            if (fraudStatus === 'challenge') {
                finalStatus = OrderStatus.PENDING_PAYMENT; 
            } else if (fraudStatus === 'accept') {
                finalStatus = OrderStatus.WAITING_PROCESS; 
            }
        } else if (transactionStatus === 'settlement') {
            finalStatus = OrderStatus.WAITING_PROCESS; 
        } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
            finalStatus = OrderStatus.CANCELED; 
        } else if (transactionStatus === 'pending') {
            finalStatus = OrderStatus.PENDING_PAYMENT;
        }

        return await prisma.order.update({
            where: { id: orderId },
            data: { 
                // PERBAIKAN TOTAL: Masukkan objek enum murni ke metode update!
                status: finalStatus 
            }
        });
    }

    async getOrderById(id: string, user: any) {
        return await prisma.order.findUnique({
            where: { id, userId: user.id },
            include: { items: true },
        });
    }

    async getAll(page: number = 1, limit: number = 50, user: any) {
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