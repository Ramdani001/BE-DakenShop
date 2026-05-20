import { Router } from "express";
import { ProductController } from "./controllers/product.controller";
import { CategoryController } from "./controllers/category.controller";
import { OrderController } from "./controllers/order.controller";
import { AuthController } from "./controllers/auth.controller";
import { ProfileController } from "./controllers/profile.controller";
import { VariantController } from "./controllers/variant.controller";
import { CartController } from "./controllers/cart.controller"; 

const rootRouter = Router();

rootRouter.use("/auth", new AuthController().router);
rootRouter.use("/products", new ProductController().router);
rootRouter.use("/categories", new CategoryController().router);
rootRouter.use("/orders", new OrderController().router);
rootRouter.use("/profile", new ProfileController().router);
rootRouter.use("/variants", new VariantController().router);

rootRouter.use("/cart", new CartController().router); 

export default rootRouter;