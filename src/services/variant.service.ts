import prisma from "../../prisma/prisma";

export class VariantService {

    async getByProduct(productId: string) {
        const productExists = await prisma.product.findUnique({
            where: { id: productId }
        });
        
        if (!productExists) {
            throw new Error("Product not found");
        }

        return await prisma.productType.findMany({
            where: { productId },
            orderBy: { type: "asc" }
        });
    }

    async create(data: { name: string; price: number; productId: string }) {
        const { name, price, productId } = data;

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
                type: name,
                price: Number(price) || 0,
                productId
            }
        });
    }

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
            updateData.type = name;
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