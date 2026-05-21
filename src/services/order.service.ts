import prisma from "../../prisma/prisma";
const midtransClient = require('midtrans-client');

// Inisialisasi Midtrans Snap Client
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

export class OrderService {
    async createOrder(data: any, user: any) {
        const { customerName, customerEmail, customerPhone, address, cartItems } = data;

        let totalAmount = 0;
        const itemsToCreate = [];
        const midtransItems = []; // Khusus format item detail ke midtrans

        // 1. Validasi produk & kalkulasi total harga
        for (const item of cartItems) {
            const productType = await prisma.productType.findUnique({
                where: { id: item.variantId || item.productTypeId }, // handle kecocokan key id varian
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
                name: `${productType.product.name} (${productType.type})`.substring(0, 50) // limit batas karakter midtrans
            });
        }

        // 2. Buat ID Order unik terlebih dahulu
        const orderId = "DS-" + Date.now() + Math.floor(1000 + Math.random() * 9000);

        // 3. Siapkan Payload parameter untuk dikirim ke Midtrans Snap
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

        // 4. Request token ke Midtrans
        const transaction = await snap.createTransaction(parameter);

        // 5. Simpan data transaksi final ke database beserta token dari Midtrans
        return await prisma.order.create({
            data: {
                id: orderId, // Menggunakan custom orderId yang terdaftar di midtrans
                customerName,
                customerEmail,
                customerPhone,
                address,
                totalAmount,
                userId: user.id,
                status: "PENDING",
                snapToken: transaction.token,
                snapUrl: transaction.redirect_url,
                items: {
                    create: itemsToCreate,
                },
            },
            include: { items: true },
        });
    }

    // Fungsi untuk mengupdate status dari webhook notification Midtrans
    async handleNotification(notificationData: any) {
        const statusResponse = await snap.transaction.notification(notificationData);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        let finalStatus = "PENDING";

        if (transactionStatus === 'capture') {
            if (fraudStatus === 'challenge') finalStatus = "CHALLENGE";
            else if (fraudStatus === 'accept') finalStatus = "SETTLEMENT";
        } else if (transactionStatus === 'settlement') {
            finalStatus = "SETTLEMENT";
        } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
            finalStatus = "CANCELLED";
        } else if (transactionStatus === 'pending') {
            finalStatus = "PENDING";
        }

        return await prisma.order.update({
            where: { id: orderId },
            data: { status: finalStatus }
        });
    }

    // ... mempertahankan method getOrderById dan getAll lama Anda
    async getOrderById(id: string, user: any) {
        return await prisma.order.findUnique({
            where: { id },
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