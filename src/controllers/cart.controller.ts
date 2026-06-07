import { Request, Response, Router } from "express";
import { CartService } from "../services/cart.service";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { Role } from "@prisma/client";

const cartService = new CartService();

export class CartController {
    public router = Router();

    constructor() {
        this.initRoutes();
    }

private initRoutes() {
    
    this.router.get("/", authenticate, this.getCart);
    this.router.post("/add", this.addToCart);
    this.router.put("/item/:id", authenticate, this.updateQuantity);
    this.router.delete("/item/:id", authenticate, this.removeItem);
    this.router.delete("/clear", authenticate, this.clearCart);
}

    async getCart(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id; 
            
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized. User ID tidak ditemukan." });
            }

            const cart = await cartService.getCartByUserId(userId);
            return res.status(200).json({
                success: true,
                message: "Berhasil mengambil data keranjang.",
                data: cart,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Terjadi kesalahan pada server.",
            });
        }
    }

    // 2. POST /api/cart/add
    async addToCart(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const { productId, quantity } = req.body;

            console.log(userId)

            if (!userId) {
                return res.status(401).json({ message: "Unauthorized." });
            }

            if (!productId || !quantity || quantity <= 0) {
                return res.status(400).json({ message: "Product ID dan Quantity yang valid wajib diisi." });
            }

            const updatedItem = await cartService.addToCart(userId, { 
                productId, 
                quantity: Number(quantity) 
            });

            return res.status(201).json({
                success: true,
                message: "Produk berhasil ditambahkan ke keranjang.",
                data: updatedItem,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Terjadi kesalahan saat menambah item.",
            });
        }
    }

    // 3. PUT /api/cart/item/:id
    async updateQuantity(req: Request, res: Response) {
        try {
            // SOLUSI: Ditambahkan 'as string' untuk menegaskan tipe data ke TypeScript
            const cartItemId = req.params.id as string;
            const { quantity } = req.body;

            if (quantity === undefined || isNaN(Number(quantity))) {
                return res.status(400).json({ message: "Quantity harus berupa angka." });
            }

            const updatedItem = await cartService.updateQuantity(cartItemId, Number(quantity));

            return res.status(200).json({
                success: true,
                message: "Jumlah item berhasil diperbarui.",
                data: updatedItem,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Gagal memperbarui jumlah item.",
            });
        }
    }

    // 4. DELETE /api/cart/item/:id
    async removeItem(req: Request, res: Response) {
        try {
            // SOLUSI: Ditambahkan 'as string' untuk menegaskan tipe data ke TypeScript
            const cartItemId = req.params.id as string;

            await cartService.removeItem(cartItemId);

            return res.status(200).json({
                success: true,
                message: "Item berhasil dihapus dari keranjang.",
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Gagal menghapus item.",
            });
        }
    }

    // 5. DELETE /api/cart/clear
    async clearCart(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;

            if (!userId) {
                return res.status(401).json({ message: "Unauthorized." });
            }

            await cartService.clearCart(userId);

            return res.status(200).json({
                success: true,
                message: "Seluruh isi keranjang berhasil dikosongkan.",
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Gagal mengosongkan keranjang.",
            });
        }
    }
}