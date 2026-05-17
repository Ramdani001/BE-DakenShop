import prisma from "../../prisma/prisma"; // Sesuaikan dengan path instansiasi prisma Anda

export class VariantService {
    /**
     * Mengambil semua varian berdasarkan ID produk tertentu
     */
    async getByProduct(productId: string) {
        const productExists = await prisma.product.findUnique({
            where: { id: productId }
        });
        
        if (!productExists) {
            throw new Error("Product not found");
        }

        return await prisma.productType.findMany({
            where: { productId },
            orderBy: { type: "asc" } // 👈 Selesai! Diganti ke 'type' sesuai schema.prisma
        });
    }

    /**
     * Menambahkan varian baru ke dalam produk
     */
    async create(data: { name: string; price: number; productId: string }) {
        const { name, price, productId } = data; // Tetap menerima 'name' dari frontend

        if (!name || name.trim() === "") {
            throw new Error("Variant name is required");
        }
        if (price < 0) {
            throw new Error("Price cannot be negative");
        }

        const productExists = await prisma.product.findUnique({
            where: { id: productId }
        });
        if (!productExists) {
            throw new Error("Target product not found");
        }

        return await prisma.productType.create({
            data: {
                type: name, // 👈 Dipetakan: frontend 'name' masuk ke kolom 'type' di Prisma
                price: Number(price) || 0,
                productId
            }
        });
    }

    /**
     * Memperbarui detail varian berdasarkan ID Varian
     */
    async update(id: string, data: { name?: string; price?: number }) {
        const { name, price } = data;

        const existingVariant = await prisma.productType.findUnique({
            where: { id }
        });
        if (!existingVariant) {
            throw new Error("Variant not found");
        }

        const updateData: any = {};
        if (name !== undefined) {
            if (name.trim() === "") throw new Error("Variant name cannot be empty");
            updateData.type = name; // 👈 Dipetakan ke kolom 'type'
        }
        if (price !== undefined) {
            if (price < 0) throw new Error("Price cannot be negative");
            updateData.price = Number(price);
        }

        return await prisma.productType.update({
            where: { id },
            data: updateData
        });
    }

    /**
     * Menghapus varian spesifik berdasarkan ID
     */
    async delete(id: string) {
        const existingVariant = await prisma.productType.findUnique({
            where: { id }
        });
        
        if (!existingVariant) {
            throw new Error("Variant not found");
        }

        const siblingCount = await prisma.productType.count({
            where: { productId: existingVariant.productId }
        });
        
        if (siblingCount <= 1) {
            throw new Error("Cannot delete the last remaining variant of this product");
        }

        return await prisma.productType.delete({
            where: { id }
        });
    }
}