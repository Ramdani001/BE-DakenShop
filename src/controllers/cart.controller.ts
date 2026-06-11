import { Request, Response, Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { CartService } from "../services/cart.service";

const cartService = new CartService();

export class CartController {
    public router = Router();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/", authenticate, this.getCart);
        this.router.post("/", authenticate, this.addToCart);
        this.router.put("/item/:id", authenticate, this.updateQuantity);
        this.router.delete("/item/:id", authenticate, this.removeItem);
        this.router.delete("/clear", authenticate, this.clearCart);
    }

    // Helper untuk memastikan input selalu string
    private toString = (value: any): string => {
        return Array.isArray(value) ? value[0] : value || "";
    };

    private getUserId = (req: Request): string => {
        return req.user?.userId || "";
    };

    private getCart = async (req: Request, res: Response) => {
        try {
            const userId = this.getUserId(req);
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

            const cart = await cartService.getCartByUserId(userId);
            return res.status(200).json({ success: true, data: cart });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    };

    private addToCart = async (req: Request, res: Response) => {
        try {
            const userId = this.getUserId(req);
            const { productId, quantity, productTypeId } = req.body;

            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });
            if (!productId || !quantity) return res.status(400).json({ message: "Invalid input." });

            const updatedItem = await cartService.addToCart(userId, {
                productId: this.toString(productId),
                productTypeId: this.toString(productTypeId),
                quantity: Number(quantity),
            });

            return res.status(201).json({ success: true, data: updatedItem });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    };

    private updateQuantity = async (req: Request, res: Response) => {
        try {
            const cartItemId = this.toString(req.params.id);
            const { quantity } = req.body;

            const updatedItem = await cartService.updateQuantity(cartItemId, Number(quantity));
            return res.status(200).json({ success: true, data: updatedItem });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    };

    private removeItem = async (req: Request, res: Response) => {
        try {
            const cartItemId = this.toString(req.params.id);
            await cartService.removeItem(cartItemId);
            return res.status(200).json({ success: true, message: "Item dihapus." });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    };

    private clearCart = async (req: Request, res: Response) => {
        try {
            const userId = this.getUserId(req);
            if (!userId) return res.status(401).json({ message: "Unauthorized." });

            await cartService.clearCart(userId);
            return res.status(200).json({ success: true, message: "Keranjang dikosongkan." });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    };
}
