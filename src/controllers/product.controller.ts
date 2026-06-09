import { Request, Response, Router } from "express";
import { ProductService } from "../services/product.service";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const UPLOAD_DIR = "uploads/images/products";

// 1. Konfigurasi Penyimpanan Berkas Massal (Disk Storage)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "prod-" + uniqueSuffix + path.extname(file.originalname));
    },
});

// 2. Inisialisasi Multer: Sinkronisasi Limit Maksimal 6 Gambar
const upload = multer({ 
    storage: storage,
    limits: { files: 6 } 
});

export class ProductController {
    public router = Router();
    private productService = new ProductService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/latest", this.getBestSeller);
        this.router.get("/", this.getAll);
        this.router.get("/:id", this.getOne);

        // Menggunakan field name 'images' dengan batasan maksimum 6 file
        this.router.post("/", authenticate, authorize([Role.ADMIN]), upload.array("images", 6), this.create);
        this.router.put("/:id", authenticate, authorize([Role.ADMIN]), upload.array("images", 6), this.update);

        this.router.delete("/:id", authenticate, authorize([Role.ADMIN]), this.delete);
    }

    private getAll = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const result = await this.productService.getAll(page, limit);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    };

    private getBestSeller = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const result = await this.productService.getBestSeller(page, limit);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    };

    private getOne = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            const result = await this.productService.getOne(id);
            res.json(result);
        } catch (error: any) {
            res.status(404).json({ message: error.message });
        }
    };

    // ==========================================
    // ACTION: TAMBAH PRODUK BARU (POST)
    // ==========================================
    private create = async (req: Request, res: Response) => {
        const files = req.files as Express.Multer.File[] || [];
        try {
            const { name, description, discountPercentage, categoryId, types, imgUrl } = req.body;
            const parsedTypes = types ? JSON.parse(types) : [];
            
            // Tampung seluruh path file baru yang berhasil masuk lewat Multer
            let imagePaths: string[] = files.map(file => `/${UPLOAD_DIR}/${file.filename}`);

            // Jalur fallback: Jika diunggah lewat import Excel
            if (imagePaths.length === 0 && imgUrl) {
                try {
                    imagePaths = imgUrl.startsWith("[") ? JSON.parse(imgUrl) : [imgUrl];
                } catch {
                    imagePaths = [imgUrl];
                }
            }

            // SINKRONISASI: Menggunakan 'imgUrl' sesuai dengan skema database Prisma Anda
            const result = await this.productService.create({
                name,
                description,
                discountPercentage: discountPercentage ? parseFloat(discountPercentage) : 0,
                categoryId,
                imgUrl: JSON.stringify(imagePaths), 
                types: parsedTypes,
            });

            res.status(201).json(result);
        } catch (error: any) {
            // Rollback Mechanism: Hapus berkas fisik di server jika query database gagal
            files.forEach(file => {
                const filePath = path.join(process.cwd(), UPLOAD_DIR, file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
            res.status(400).json({ message: error.message });
        }
    };

    // ==========================================
    // ACTION: UPDATE & EDIT DATA PRODUK (PUT)
    // ==========================================
    private update = async (req: Request, res: Response) => {
        const files = req.files as Express.Multer.File[] || [];
        try {
            const id = req.params.id as string;
            const { name, description, discountPercentage, categoryId, types, existingImages } = req.body;

            // 1. Ambil data produk lama dari database menggunakan Service
            const existingProduct = await this.productService.getOne(id);

            // 2. Ambil sisa daftar gambar lama yang dipertahankan user dari frontend
            let retainedImages: string[] = [];
            if (existingImages) {
                retainedImages = typeof existingImages === "string" ? JSON.parse(existingImages) : existingImages;
            }

            // 3. Petakan berkas gambar baru hasil unggahan lokal komputer
            const newUploadedImages = files.map(file => `/${UPLOAD_DIR}/${file.filename}`);

            // 4. Gabungkan sisa gambar lama dan berkas baru ke dalam satu array tunggal
            const finalImagesArray = [...retainedImages, ...newUploadedImages];

            // SINKRONISASI: Properti diubah kembali menjadi 'imgUrl' agar klop dengan Prisma
            const updateData: any = {
                name,
                description,
                categoryId,
                imgUrl: JSON.stringify(finalImagesArray) 
            };

            if (discountPercentage) updateData.discountPercentage = parseFloat(discountPercentage);
            if (types) updateData.types = typeof types === "string" ? JSON.parse(types) : types;

            // 5. Eksekusi pembaruan ke database lewat service
            const result = await this.productService.update(id, updateData);

            // 6. GARBAGE COLLECTION: Bersihkan file fisik di server yang dihapus user lewat tombol X
            let oldImagesInDb: string[] = [];
            if (existingProduct && existingProduct.imgUrl) {
                try {
                    oldImagesInDb = existingProduct.imgUrl.startsWith("[") ? JSON.parse(existingProduct.imgUrl) : [existingProduct.imgUrl];
                } catch {
                    oldImagesInDb = [existingProduct.imgUrl];
                }
            }

            // Jika file lama di DB tidak terdaftar lagi di array baru, hapus filenya secara permanen
            oldImagesInDb.forEach((oldImg) => {
                if (!finalImagesArray.includes(oldImg) && !oldImg.startsWith("http")) {
                    const deletePath = path.join(process.cwd(), oldImg);
                    if (fs.existsSync(deletePath)) {
                        fs.unlinkSync(deletePath);
                    }
                }
            });

            res.json(result);
        } catch (error: any) {
            // Bersihkan file baru jika proses update gagal ditolak sistem database
            files.forEach(file => {
                const newPath = path.join(process.cwd(), UPLOAD_DIR, file.filename);
                if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
            });
            res.status(400).json({ message: error.message });
        }
    };

    // ==========================================
    // ACTION: HAPUS PRODUK TOTAL (DELETE)
    // ==========================================
    private delete = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            // Ambil data produk terlebih dahulu untuk mengekstrak berkas gambar
            const product = await this.productService.getOne(id);
            await this.productService.delete(id);

            // SINKRONISASI: Membaca properti 'imgUrl' produk saat proses hapus file dari storage
            if (product && product.imgUrl) {
                let imagesToDelete: string[] = [];
                try {
                    imagesToDelete = product.imgUrl.startsWith("[") ? JSON.parse(product.imgUrl) : [product.imgUrl];
                } catch {
                    imagesToDelete = [product.imgUrl];
                }

                imagesToDelete.forEach((imgUrlPath) => {
                    if (imgUrlPath && !imgUrlPath.startsWith("http")) {
                        const filePath = path.join(process.cwd(), imgUrlPath);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                });
            }

            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };
}