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
                include: {
                    types: true,
                    category: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            prisma.product.count(),
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
        return await prisma.product.create({
            data: {
                name,
                imgUrl,
                description,
                discountPercentage,
                categoryId,
                types: {
                    create: types,
                },
            },
            include: { types: true },
        });
    }

    async update(id: string, data: any) {
        const { name, imgUrl, description, discountPercentage, categoryId, types } = data;

        return await prisma.product.update({
            where: { id },
            data: {
                name,
                imgUrl,
                description,
                discountPercentage,
                categoryId,
                types: types
                    ? {
                          deleteMany: {},
                          create: types,
                      }
                    : undefined,
            },
            include: { types: true },
        });
    }

    async delete(id: string) {
        return await prisma.product.delete({ where: { id } });
    }
}
