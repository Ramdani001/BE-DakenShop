import { Request, Response, Router } from "express";
import { AuthService } from "../services/auth.service";
import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = "uploads/images/profiles";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "user-" + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

export class AuthController {
    public router = Router();
    private authService = new AuthService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        
        this.router.post("/register", upload.single("image"), this.register);
        this.router.post("/login", this.login);
    }

    private register = async (req: Request, res: Response) => {
        try {
            
            const registrationData = {
                name: req.body.name,
                email: req.body.email,
                password: req.body.password,
                phone: req.body.phone,
                address: req.body.address,
                image: req.file ? `/${UPLOAD_DIR}/${req.file.filename}` : null
            };

            const result = await this.authService.register(registrationData);
            res.status(201).json(result);
        } catch (error: any) {
            
            if (req.file) {
                const filePath = path.join(process.cwd(), UPLOAD_DIR, req.file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
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