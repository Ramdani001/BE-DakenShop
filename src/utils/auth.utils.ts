import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "asdasdasdqweqweqweqweasdadas";

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export const generateToken = (payload: { userId: string; email: string; role: Role }) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
};

export const verifyToken = (token: string) => {
    return jwt.verify(token, JWT_SECRET);
};
