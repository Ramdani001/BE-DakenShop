import prisma from "../../prisma/prisma";
import { comparePassword, generateToken, hashPassword } from "../utils/auth.utils";

export class AuthService {
    async register(data: any) {
        // PERBAIKAN 1: Tambahkan 'role' di sini agar bisa dibaca oleh Prisma di bawah
        const { email, password, name, phone, address, image, role } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new Error("Email already registered");

        const hashedPassword = await hashPassword(password);

        return await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: role || 'USER', // Beri nilai default jika tidak dikirim dari frontend
                name,
                phone,
                address,
                image,
            },

            select: { 
                id: true, 
                email: true, 
                role: true,
                name: true,
                image: true 
            },
        });
    }

    async login(data: any) {
        const { email, password } = data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new Error("Invalid email or password");

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) throw new Error("Invalid email or password");

        const token = generateToken({ 
            userId: user.id, 
            email: user.email,
            role: user.role 
        });

        // PERBAIKAN 2: Sertakan 'role' di dalam return object user
        return {
            user: { 
                id: user.id, 
                email: user.email, 
                name: user.name,
                role: user.role // <-- INI DIA YANG MEMBUAT FRONTEND ANDA MANDEK KEMARIN!
            },
            token,
        };
    }
}