import { Request, Response, Router } from "express";
import { UserService } from "../services/user.service";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { hashPassword } from "../utils/auth.utils";

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

export class ProfileController {
    public router = Router();
    private userService = new UserService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {

        this.router.get("/me", authenticate, this.getProfile);

        this.router.get("/", authenticate, authorize([Role.ADMIN]), this.getAll);
        this.router.get("/:id", authenticate, authorize([Role.ADMIN, Role.USER]), this.getOne);
        this.router.post("/", authenticate, authorize([Role.ADMIN]), upload.single("image"), this.create);
        this.router.put("/:id", authenticate, authorize([Role.ADMIN, Role.USER]), upload.single("image"), this.update);
        this.router.delete("/:id", authenticate, authorize([Role.ADMIN]), this.delete);
    }

    private getProfile = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId as string; 

            if (!userId) {
                return res.status(401).json({ message: "ID User tidak ditemukan dalam token" });
            }

            const user = await this.userService.getById(userId);
            res.json(user);
        } catch (error: any) {
            res.status(404).json({ message: error.message });
        }
    };

    private getAll = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const search = (req.query.search as string) || ""; 

            const result = await this.userService.getAll(page, limit, search);
            
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    };

    private getOne = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string; 
            const result = await this.userService.getById(id);
            res.json(result);
        } catch (error: any) {
            res.status(404).json({ message: error.message });
        }
    };

    private create = async (req: Request, res: Response) => {
        try {
            const { name, email, password, role, phone, address } = req.body;
            const image = req.file ? `/${UPLOAD_DIR}/${req.file.filename}` : "";

            const hashedPassword = await hashPassword(password);

            const result = await this.userService.create({
                name,
                email,
                password: hashedPassword,
                role,
                phone,
                address,
                image
            });

            res.status(201).json(result);
        } catch (error: any) {
            if (req.file) {
                const filePath = path.join(process.cwd(), UPLOAD_DIR, req.file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            res.status(400).json({ message: error.message });
        }
    };

    private update = async (req: Request, res: Response) => {
        let oldFileToDelete: string | null = null;
        try {
            // 1. Pastikan ID diambil dengan benar (Type Casting as string)
            const id = req.params.id as string;
            
            // 2. Ambil data user yang ada
            const existingUser = await this.userService.getById(id);
            if (!existingUser) {
                return res.status(404).json({ message: "User tidak ditemukan" });
            }

            // 3. Susun data update
            // Gunakan destructuring untuk keamanan agar tidak semua req.body masuk
            const { name, phone, address, password, role } = req.body;
            
            let updateData: any = {};
            if (name) updateData.name = name;
            if (phone) updateData.phone = phone;
            if (address) updateData.address = address;
            if (role) updateData.role = role;

            // 4. Handle Password Hashing
            if (password && password.trim() !== "") {
                updateData.password = await hashPassword(password);
            }

            // 5. Handle File Upload (Image)
            if (req.file) {
                updateData.image = `/uploads/images/profiles/${req.file.filename}`;
                oldFileToDelete = (existingUser as any).image;
            }

            // 6. Jalankan Update di Service
            const result = await this.userService.update(id, updateData);

            // 7. Cleanup: Hapus file lama jika update berhasil dan ada file baru
            if (req.file && oldFileToDelete) {
                // Hapus '/' di awal jika ada agar path.join bekerja dengan benar
                const cleanPath = oldFileToDelete.startsWith('/') ? oldFileToDelete.substring(1) : oldFileToDelete;
                const oldPath = path.join(process.cwd(), cleanPath);
                
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            res.json(result);
        } catch (error: any) {
            // 8. Rollback: Hapus file baru jika proses database gagal
            if (req.file) {
                const newPath = path.join(process.cwd(), "uploads/images/profiles", req.file.filename);
                if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
            }
            res.status(400).json({ message: error.message || "Terjadi kesalahan saat update" });
        }
    };

    private delete = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        
        // Eksekusi penghapusan di service database kamu
        await this.userService.delete(id);

        // JANGAN biarkan kosong atau mengembalikan res.sendStatus(204) tanpa handling di frontend
        // Solusi terbaik: kirim JSON berupa pesan sukses
        return res.status(200).json({ 
            success: true,
            message: "User berhasil dihapus secara permanen" 
        });
    } catch (error: any) {
        return res.status(400).json({ 
            success: false,
            message: error.message || "Gagal menghapus user" 
        });
    }
};
}