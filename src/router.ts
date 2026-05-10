import { Router } from "express";
import { ProductController } from "./controllers/product.controller";
import { CategoryController } from "./controllers/category.controller";
import { OrderController } from "./controllers/order.controller";
import { AuthController } from "./controllers/auth.controller";

const rootRouter = Router();

rootRouter.use("/auth", new AuthController().router);
rootRouter.use("/products", new ProductController().router);
rootRouter.use("/categories", new CategoryController().router);
rootRouter.use("/orders", new OrderController().router);

export default rootRouter;
