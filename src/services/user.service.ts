import prisma from "../../prisma/prisma";

export class UserService {
    
    async getAll(page: number = 1, limit: number = 20, search: string = "") {
        const skip = (page - 1) * limit;

        const whereCondition = search
            ? {
                name: {
                    contains: search,
                    mode: "insensitive" as const,
                },
            }
            : {};

        const [data, total] = await Promise.all([
            prisma.user.findMany({
                where: whereCondition,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    phone: true,
                    address: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.user.count({
                where: whereCondition,
            }),
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

    async getById(id: string) {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                phone: true,
                address: true,
                createdAt: true,
            }
        });
        
        if (!user) throw new Error("User not found");
        return user;
    }

    async create(data: any) {
        const { email, password, name, role, phone, address, image } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new Error("Email already registered");

        return await prisma.user.create({
            data: {
                email,
                password,
                name,
                role,
                phone,
                address,
                image
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                image: true
            }
        });
    }

    async update(id: string, data: any) {
        const { name, email, image, phone, address, role, password } = data;

        if (email) {
            const existingEmail = await prisma.user.findFirst({
                where: { 
                    email,
                    NOT: { id } 
                }
            });
            if (existingEmail) throw new Error("Email already in use");
        }

        return await prisma.user.update({
            where: { id },
            data: {
                name,
                email,
                image,
                phone,
                address,
                role,     
                password  
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                phone: true,
                address: true,
            }
        });
    }

    async delete(id: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new Error("User tidak ditemukan");

        return await prisma.user.delete({ where: { id } });
    }
}