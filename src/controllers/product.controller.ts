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
            
            // 1. Ambil path dari berkas-berkas biner baru hasil proses Multer
            let imagePaths: string[] = files.map(file => `/${UPLOAD_DIR}/${file.filename}`);

            // Jalur fallback: Mengantisipasi jika data datang via Import Excel
            if (imagePaths.length === 0 && imgUrl) {
                try {
                    imagePaths = imgUrl.startsWith("[") ? JSON.parse(imgUrl) : [imgUrl];
                } catch {
                    imagePaths = [imgUrl];
                }
            }

            // 2. FORCE VALIDATION: Pastikan array dibersihkan dari teks string kosong ("") akibat form input liar
            imagePaths = imagePaths.filter(p => p && p.trim() !== "");

            // 3. SINKRONISASI MUTLAK: Selalu bungkus menjadi JSON string array ["..."] saat disimpan ke Postgres
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
            // Rollback Mechanism: Bersihkan file fisik di server jika transaksi database gagal ditolak
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

            // 1. Ambil data record lama dari database untuk keperluan komparasi sinkronisasi file
            const existingProduct = await this.productService.getOne(id);

            // 2. Ambil sisa daftar file gambar lama yang dipertahankan oleh user di UI frontend
            let retainedImages: string[] = [];
            if (existingImages) {
                retainedImages = typeof existingImages === "string" ? JSON.parse(existingImages) : existingImages;
            }

            // 3. Petakan berkas gambar baru murni hasil tangkapan upload.array() Multer
            const newUploadedImages = files.map(file => `/${UPLOAD_DIR}/${file.filename}`);

            // 4. Gabungkan sisa gambar lama + berkas baru ke dalam satu kesatuan array
            let finalImagesArray = [...retainedImages, ...newUploadedImages];

            // Bersihkan data array dari space kosong liar sebelum di-serialize
            finalImagesArray = finalImagesArray.filter(p => p && p.trim() !== "");

            // 5. Bangun objek data dengan enkapsulasi key 'imgUrl' dalam bentuk JSON string array
            const updateData: any = {
                name,
                description,
                categoryId,
                imgUrl: JSON.stringify(finalImagesArray) 
            };

            if (discountPercentage) updateData.discountPercentage = parseFloat(discountPercentage);
            if (types) updateData.types = typeof types === "string" ? JSON.parse(types) : types;

            // 6. Eksekusi pembaruan data relasional ke database via Service
            const result = await this.productService.update(id, updateData);

            // 7. GARBAGE COLLECTION: Hapus file fisik lama di server jika sengaja dibuang via klik tombol X di frontend
            let oldImagesInDb: string[] = [];
            if (existingProduct && existingProduct.imgUrl) {
                const rawDbImg = existingProduct.imgUrl.trim();
                try {
                    oldImagesInDb = rawDbImg.startsWith("[") ? JSON.parse(rawDbImg) : [rawDbImg];
                } catch {
                    oldImagesInDb = [rawDbImg];
                }
            }

            // Jika file lama di DB tidak terdaftar lagi di dalam array gabungan yang baru, singkirkan dari server
            oldImagesInDb.forEach((oldImg) => {
                if (oldImg && !finalImagesArray.includes(oldImg) && !oldImg.startsWith("http")) {
                    const deletePath = path.join(process.cwd(), oldImg);
                    if (fs.existsSync(deletePath)) {
                        fs.unlinkSync(deletePath);
                    }
                }
            });

            res.json(result);
        } catch (error: any) {
            // Bersihkan sisa file baru jika proses update dibatalkan/gagal di level internal database
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

            // Ambil data produk master sebelum dieksekusi hapus untuk mengambil metadata gambar
            const product = await this.productService.getOne(id);
            await this.productService.delete(id);

            // Sapu bersih seluruh file fisik gambar yang terikat dengan produk ini di storage server Anda
            if (product && product.imgUrl) {
                let imagesToDelete: string[] = [];
                const rawDbImg = product.imgUrl.trim();
                try {
                    imagesToDelete = rawDbImg.startsWith("[") ? JSON.parse(rawDbImg) : [rawDbImg];
                } catch {
                    imagesToDelete = [rawDbImg];
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