import { Request, Response, Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { VariantService } from "../services/variant.service";

export class VariantController {
    public router = Router();
    private variantService = new VariantService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/product/:productId", this.getByProduct);
        this.router.post("/", authenticate, authorize([Role.ADMIN]), this.create);
        this.router.put("/:id", authenticate, authorize([Role.ADMIN]), this.update);
        this.router.delete("/:id", authenticate, authorize([Role.ADMIN]), this.delete);
    }

    private getByProduct = async (req: Request, res: Response) => {
        try {
            const productId = req.params.productId as string;
            
            const result = await this.variantService.getByProduct(productId);
            res.json(result);
        } catch (error: any) {
            if (error.message === "Product not found") {
                res.status(404).json({ message: error.message });
            } else {
                res.status(500).json({ message: error.message });
            }
        }
    };

    private create = async (req: Request, res: Response) => {
        try {
            const { name, price, productId } = req.body;
            const result = await this.variantService.create({ 
                name, 
                price, 
                productId: productId as string
            });
            res.status(201).json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };

    private update = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            const { name, price } = req.body;
            
            const result = await this.variantService.update(id, { name, price });
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };

    private delete = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            
            await this.variantService.delete(id);
            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };
}