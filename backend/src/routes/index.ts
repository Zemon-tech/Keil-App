import { Router } from "express";
import healthRoutes from "./health.routes";
import userRoutes from "./user.routes";

const router = Router();

// Register routes
router.use("/health", healthRoutes);
router.use("/users", userRoutes);

router.get("/debug", (req, res) => {
    res.json({ message: "Router index is working" });
});

export default router;
