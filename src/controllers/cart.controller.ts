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

    private getCart = async (req: Request, res: Response) => {
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
    };

    // ==========================================
    // ACTION: TAMBAH ITEM KE KERANJANG (POST /api/cart)
    // ==========================================
    private addToCart = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user?.id;
            const { productId, quantity } = req.body;

            if (!userId) {
                return res.status(401).json({ message: "Unauthorized. Silakan login terlebih dahulu." });
            }

            if (!productId || quantity === undefined || Number(quantity) <= 0) {
                return res.status(400).json({ message: "Product ID dan Quantity yang valid wajib diisi." });
            }

            // Memanggil service dengan aman tanpa risiko lost scope context
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
    };

    // ==========================================
    // ACTION: UPDATE QUANTITY ITEM (PUT /api/cart/item/:id)
    // ==========================================
    private updateQuantity = async (req: Request, res: Response) => {
        try {
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
    };

    // ==========================================
    // ACTION: HAPUS SATU ITEM (DELETE /api/cart/item/:id)
    // ==========================================
    private removeItem = async (req: Request, res: Response) => {
        try {
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
    };

    // ==========================================
    // ACTION: KOSONGKAN KERANJANG (DELETE /api/cart/clear)
    // ==========================================
    private clearCart = async (req: Request, res: Response) => {
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
    };
}