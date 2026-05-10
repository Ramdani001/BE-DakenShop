import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/auth.utils";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = verifyToken(token) as any;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ message: "Invalid token" });
    }
};

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden: You don't have access" });
        }
        next();
    };
};
