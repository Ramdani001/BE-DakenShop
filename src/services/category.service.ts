import prisma from "../../prisma/prisma";

export class CategoryService {
    async getAll(page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            prisma.category.findMany({
                skip: skip,
                take: limit,
                include: {
                    _count: {
                        select: { products: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.category.count(),
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
        const category = await prisma.category.findUnique({
            where: { id },
            include: { products: true },
        });

        if (!category) {
            throw new Error(`Category with ID ${id} not found.`);
        }

        return category;
    }

    async create(data: { label: string; iconUrl: string }) {
        return await prisma.category.create({
            data: {
                label: data.label,
                iconUrl: data.iconUrl,
            },
        });
    }

    async update(id: string, data: { label?: string; iconUrl?: string }) {
        await this.getOne(id);

        return await prisma.category.update({
            where: { id },
            data: {
                label: data.label,
                iconUrl: data.iconUrl,
            },
        });
    }

    async delete(id: string) {
        await this.getOne(id);

        return await prisma.category.delete({
            where: { id },
        });
    }
}
