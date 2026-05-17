import { Request, Response, Router } from "express";
import { CategoryService } from "../services/category.service";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { Role } from "@prisma/client";

const UPLOAD_DIR = "uploads/images/categories";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

export class CategoryController {
    public router = Router();
    private categoryService = new CategoryService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/", this.getAll);
        this.router.get("/:id", this.getOne);
        this.router.post("/", authenticate, authorize([Role.ADMIN]), upload.single("icon"), this.create);
        this.router.put("/:id", authenticate, authorize([Role.ADMIN]), upload.single("icon"), this.update);
        this.router.delete("/:id", authenticate, authorize([Role.ADMIN]), this.delete);
    }

    private getAll = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10; // Disesuaikan default ke 10 agar serasi dengan frontend
            const result = await this.categoryService.getAll(page, limit);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    };

    private getOne = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            const result = await this.categoryService.getOne(id);
            res.json(result);
        } catch (error: any) {
            res.status(404).json({ message: error.message });
        }
    };

    private create = async (req: Request, res: Response) => {
        try {
            const { label } = req.body;
            const iconUrl = req.file ? `/${UPLOAD_DIR}/${req.file.filename}` : "";

            if (!label) {
                throw new Error("Nama kategori (label) wajib diisi");
            }

            const result = await this.categoryService.create({ label, iconUrl });
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
            const id = req.params.id as string;
            const { label } = req.body;

            const existingCategory = await this.categoryService.getOne(id);
            if (!existingCategory) {
                return res.status(404).json({ message: "Kategori tidak ditemukan" });
            }

            let updateData: any = {};
            if (label) updateData.label = label;

            if (req.file) {
                updateData.iconUrl = `/${UPLOAD_DIR}/${req.file.filename}`;
                oldFileToDelete = existingCategory.iconUrl;
            }

            const result = await this.categoryService.update(id, updateData);

            // Perbaikan pembersihan file lama jika ganti icon baru
            if (req.file && oldFileToDelete) {
                const cleanOldPath = oldFileToDelete.startsWith('/') ? oldFileToDelete.substring(1) : oldFileToDelete;
                const oldFilePath = path.join(process.cwd(), cleanOldPath);
                if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            }

            res.json(result);
        } catch (error: any) {
            if (req.file) {
                const newFilePath = path.join(process.cwd(), UPLOAD_DIR, req.file.filename);
                if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
            }
            res.status(400).json({ message: error.message });
        }
    };

    private delete = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            const category = await this.categoryService.getOne(id);
            if (!category) {
                return res.status(404).json({ message: "Kategori tidak ditemukan" });
            }

            await this.categoryService.delete(id);

            // Perbaikan pembersihan berkas gambar kategori saat dihapus dari DB
            if (category.iconUrl) {
                const cleanPath = category.iconUrl.startsWith('/') ? category.iconUrl.substring(1) : category.iconUrl;
                const filePath = path.join(process.cwd(), cleanPath);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }

            // Diubah ke status 200 dengan format JSON agar tidak memicu crash json parsing di frontend
            res.status(200).json({ success: true, message: "Kategori berhasil dihapus" });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };
}