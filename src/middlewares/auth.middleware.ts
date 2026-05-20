import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/auth.utils";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        // Cek apakah header authorization ada dan formatnya benar menggunakan Bearer
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized: Token tidak ditemukan atau format salah" });
        }

        // Ambil token murni setelah string "Bearer "
        const token = authHeader.split(" ")[1];

        const decoded = verifyToken(token) as any;
        if (!decoded) {
            return res.status(401).json({ message: "Unauthorized: Token gagal didekripsi" });
        }

        // Simpan data decoded ke dalam req menggunakan custom property assertion agar aman
        (req as any).user = decoded;
        
        next();
    } catch (error) {
        return res.status(403).json({ message: "Invalid token atau token kadaluarsa" });
    }
};

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user || !user.role) {
            return res.status(403).json({ message: "Forbidden: Informasi peran akun tidak ditemukan" });
        }

        // Antisipasi perbedaan spasi atau huruf kapital dari database VPS (Trim & Uppercase)
        const userRoleClean = String(user.role).trim().toUpperCase();
        
        // Cek apakah peran user diizinkan masuk
        const hasAccess = roles.some(role => String(role).trim().toUpperCase() === userRoleClean);

        if (!hasAccess) {
            return res.status(403).json({ message: "Forbidden: Anda tidak memiliki akses ke halaman ini" });
        }
        
        next();
    };
};