import { Request, Response, Router } from "express";
import { OrderService } from "../services/order.service";
import { authenticate } from "../middlewares/auth.middleware";

interface CustomRequest extends Request {
    user?: any;
}

export class OrderController {
    public router = Router();
    private orderService = new OrderService();

    constructor() {
        this.router.get("/", authenticate, this.getAll);
        this.router.post("/checkout", authenticate, this.checkout);
        this.router.post("/checkout-wa", authenticate, this.checkoutWa);
        this.router.get("/:id", authenticate, this.getOrderDetail);

        this.router.post("/notification", this.webHookNotification);
    }

    private getAll = async (req: CustomRequest, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const result = await this.orderService.getAll(page, limit, req.user);

            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Internal server error" });
        }
    };

    private checkout = async (req: CustomRequest, res: Response): Promise<void> => {
        try {
            const result = await this.orderService.createOrder(req.body, req.user);

            res.status(201).json({
                message: "Order placed successfully",
                data: result,
            });
        } catch (error: any) {
            res.status(400).json({ message: error.message || "Failed to create order" });
        }
    };

    private checkoutWa = async (req: CustomRequest, res: Response): Promise<void> => {
        try {
            const result = await this.orderService.createWa(req.body, req.user);

            res.status(201).json({
                message: "Order placed successfully",
                data: result,
            });
        } catch (error: any) {
            res.status(400).json({ message: error.message || "Failed to create WA order" });
        }
    };

    private getOrderDetail = async (req: CustomRequest, res: Response): Promise<void> => {
        try {
            const result = await this.orderService.getOrderById(req.params.id as string, req.user);

            if (!result) {
                res.status(404).json({ message: "Order not found" });
                return;
            }

            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message || "Error fetching order detail" });
        }
    };

    private webHookNotification = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.orderService.handleNotification(req.body);

            res.status(200).json({ status: "OK", message: "Notification processed" });
        } catch (error: any) {
            res.status(400).json({ message: error.message || "Webhook error" });
        }
    };
}
