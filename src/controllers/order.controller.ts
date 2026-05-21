import { Request, Response, Router } from "express";
import { OrderService } from "../services/order.service";
import { authenticate } from "../middlewares/auth.middleware";

export class OrderController {
    public router = Router();
    private orderService = new OrderService();

    constructor() {
        this.router.get("/", authenticate, this.getAll);
        this.router.post("/checkout", authenticate, this.checkout);
        this.router.get("/:id", authenticate, this.getOrderDetail);
        
        // Route Webhook untuk menerima update otomatis dari server Midtrans (Tanpa authenticate)
        this.router.post("/notification", this.webHookNotification);
    }

    private getAll = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const result = await this.orderService.getAll(page, limit, req.user);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    };

    private checkout = async (req: Request, res: Response) => {
        try {
            const result = await this.orderService.createOrder(req.body, req.user);
            res.status(201).json({
                message: "Order placed successfully",
                data: result, // Mengembalikan token midtrans di dalam data ini
            });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    };

    private getOrderDetail = async (req: Request, res: Response) => {
        try {
            const result = await this.orderService.getOrderById(req.params.id as string, req.user);
            res.json(result);
        } catch (error: any) {
            res.status(404).json({ message: error.message });
        }
    };

    private webHookNotification = async (req: Request, res: Response) => {
        try {
            await this.orderService.handleNotification(req.body);
            res.status(200).json({ status: "OK", message: "Notification processed" });
        } catch (error: any) {
            res.status(400).json({ message: error.error || "Webhook error" });
        }
    };
}