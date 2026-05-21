import { Request, Response, Router } from "express";
import { ProductService } from "../services/product.service";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const UPLOAD_DIR = "uploads/images/products";

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

const upload = multer({ 
    storage: storage,
    limits: { files: 4 } 
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

        this.router.post("/", authenticate, authorize([Role.ADMIN]), upload.array("image", 4), this.create);
        this.router.put("/:id", authenticate, authorize([Role.ADMIN]), upload.array("image", 4), this.update);

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

   private create = async (req: Request, res: Response) => {
    try {
    
        const { name, description, discountPercentage, categoryId, types, imgUrl } = req.body;

        const parsedTypes = types ? JSON.parse(types) : [];
        
  
        const files = req.files as Express.Multer.File[] || [];
        
       
        let finalImgUrl = "";
        if (files.length > 0) {
            finalImgUrl = `/${UPLOAD_DIR}/${files[0].filename}`;
        } else if (imgUrl) {
            finalImgUrl = imgUrl;
        }

        const result = await this.productService.create({
            name,
            description,
            discountPercentage: discountPercentage ? parseFloat(discountPercentage) : 0,
            categoryId,
            imgUrl: finalImgUrl,
            types: parsedTypes,
        });

        res.status(201).json(result);
    } catch (error: any) {
        
        const files = req.files as Express.Multer.File[] || [];
        files.forEach(file => {
            const filePath = path.join(process.cwd(), UPLOAD_DIR, file.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        res.status(400).json({ message: error.message });
    }
};

private update = async (req: Request, res: Response) => {
    let oldFileToDelete: string | null = null;
    try {
        const id = req.params.id as string;
        const { name, description, discountPercentage, categoryId, types } = req.body;

        const existingProduct = await this.productService.getOne(id);

        let updateData: any = {
            name,
            description,
            categoryId,
        };

        if (discountPercentage) updateData.discountPercentage = parseFloat(discountPercentage);
        if (types) updateData.types = JSON.parse(types);

        // 1. Cek apakah ada file baru yang diunggah saat update
        const files = req.files as Express.Multer.File[] || [];
        if (files.length > 0) {
            updateData.imgUrl = `/${UPLOAD_DIR}/${files[0].filename}`;
            oldFileToDelete = existingProduct.imgUrl;
        }

        const result = await this.productService.update(id, updateData);

        if (files.length > 0 && oldFileToDelete) {
            const oldPath = path.join(process.cwd(), oldFileToDelete);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        res.json(result);
    } catch (error: any) {
        const files = req.files as Express.Multer.File[] || [];
        files.forEach(file => {
            const newPath = path.join(process.cwd(), UPLOAD_DIR, file.filename);
            if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
        });
        res.status(400).json({ message: error.message });
    }
};

    private delete = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            const product = await this.productService.getOne(id);
            await this.productService.delete(id);

            if (product.imgUrl) {
                const filePath = path.join(process.cwd(), product.imgUrl);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }

            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };
}