import { Router } from "express";
import healthRoutes from "./health.routes";

const router = Router();

// Register routes
router.use("/health", healthRoutes);

// You can add more routes here
// router.use("/users", userRoutes);

export default router;
