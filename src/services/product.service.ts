import prisma from "../../prisma/prisma";

export class ProductService {
    async getAll(page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            prisma.product.findMany({
                skip,
                take: limit,
                include: { types: true, category: true },
                orderBy: { createdAt: "desc" },
            }),
            prisma.product.count(),
        ]);

        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async getBestSeller(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            prisma.product.findMany({
                skip: skip,
                take: limit,
                include: { types: true, category: true },
                orderBy: { createdAt: "desc" },
            }),
            prisma.product.count(),
        ]);

        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async getOne(id: string) {
        const product = await prisma.product.findUnique({
            where: { id },
            include: { types: true, category: true },
        });
        if (!product) throw new Error("Product not found");
        return product;
    }

    async create(data: any) {
        const { name, imgUrl, description, discountPercentage, categoryId, types } = data;
        
        const parsedTypes = typeof types === "string" ? JSON.parse(types) : types;

        const cleanTypes = parsedTypes 
            ? parsedTypes.map(({ id, type: variantType, price, ...rest }: any) => ({
                ...rest,
                type: variantType || "Standard",
                price: parseFloat(price) || 0
              })) 
            : [];

        const cleanDiscount = discountPercentage ? parseFloat(discountPercentage) : 0;

        return await prisma.product.create({
            data: {
                name,
                imgUrl: imgUrl || "",
                description: description || "",
                discountPercentage: cleanDiscount,
                categoryId,
                types: {
                    create: cleanTypes,
                },
            },
            include: { types: true },
        });
    }

    async update(id: string, data: any) {
        const { name, imgUrl, description, discountPercentage, categoryId, types } = data;

        const parsedTypes = typeof types === "string" ? JSON.parse(types) : types;

        const cleanTypes = parsedTypes 
            ? parsedTypes.map(({ id, type: variantType, price, ...rest }: any) => ({
                ...rest,
                type: variantType || "Standard",
                price: parseFloat(price) || 0
              })) 
            : undefined;

        const cleanDiscount = discountPercentage ? parseFloat(discountPercentage) : undefined;

        const updateData: any = {
            name,
            description,
            categoryId,
        };

        if (imgUrl !== undefined) updateData.imgUrl = imgUrl;
        if (cleanDiscount !== undefined) updateData.discountPercentage = cleanDiscount;
        
        if (cleanTypes) {
            updateData.types = {
                deleteMany: {}, 
                create: cleanTypes, 
            };
        }

        return await prisma.product.update({
            where: { id },
            data: updateData,
            include: { types: true },
        });
    }

    async delete(id: string) {
        await prisma.productType.deleteMany({
            where: { productId: id }
        });
        
        return await prisma.product.delete({ where: { id } });
    }
}