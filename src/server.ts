import express from "express";
import cors from "cors";
import path from "path";
import rootRouter from "./router";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", rootRouter);

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
    console.log(`Server ready at: http://localhost:${PORT}`);
    console.log(`Uploads accessible at: http://localhost:${PORT}/uploads`);
});
