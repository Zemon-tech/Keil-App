import { Router } from "express";
import healthRoutes from "./health.routes";
import userRoutes from "./user.routes";
import v1Routes from "./v1.routes";

const router = Router();

// Register base routes
router.use("/health", healthRoutes);
router.use("/users", userRoutes);

// Register API Version 1 routes
router.use("/v1", v1Routes);

router.get("/debug", (req, res) => {
    res.json({ message: "Router index is working" });
});

export default router;
