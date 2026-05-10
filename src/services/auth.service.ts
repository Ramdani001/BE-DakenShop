import prisma from "../../prisma/prisma";
import { comparePassword, generateToken, hashPassword } from "../utils/auth.utils";

export class AuthService {
    async register(data: any) {
        const { email, password, name } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new Error("Email already registered");

        const hashedPassword = await hashPassword(password);

        return await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
            select: { id: true, email: true, name: true },
        });
    }

    async login(data: any) {
        const { email, password } = data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new Error("Invalid email or password");

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) throw new Error("Invalid email or password");

        const token = generateToken({ userId: user.id, email, role: user.role });

        return {
            user: { id: user.id, email: user.email, name: user.name },
            token,
        };
    }
}
