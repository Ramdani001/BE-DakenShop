import { Request, Response, Router } from "express";
import { AuthService } from "../services/auth.service";

export class AuthController {
    public router = Router();
    private authService = new AuthService();

    constructor() {
        this.router.post("/register", this.register);
        this.router.post("/login", this.login);
    }

    private register = async (req: Request, res: Response) => {
        try {
            const result = await this.authService.register(req.body);
            res.status(201).json({
                message: "User registered successfully",
                data: result,
            });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };

    private login = async (req: Request, res: Response) => {
        try {
            const result = await this.authService.login(req.body);
            res.json({
                message: "Login successful",
                ...result,
            });
        } catch (error: any) {
            res.status(401).json({ message: error.message });
        }
    };
}
