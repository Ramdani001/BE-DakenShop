import { Router, Request, Response } from "express";
import { DashboardService } from "../services/Dashboard.service"; 

export class DashboardController {
  public router: Router;
  private dashboardService: DashboardService;

  constructor() {
    this.router = Router();
    this.dashboardService = new DashboardService();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/stats", this.getStats.bind(this));
  }

  private async getStats(req: Request, res: Response) {
    try {
      const stats = await this.dashboardService.getDashboardStats();
      return res.status(200).json(stats);
    } catch (error: any) {
      return res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }
  }
}