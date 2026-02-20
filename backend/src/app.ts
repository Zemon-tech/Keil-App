import express, { Express } from "express";
import cors from "cors";
import routes from "./routes";
import { config } from "./config";
import { errorHandler } from "./middlewares/error";
import { requestLogger } from "./middlewares/logger";

const app: Express = express();

// Middleware
app.use(requestLogger);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", routes);

// Base route for testing
app.get("/", (req, res) => {
    res.json({ message: "Welcome to the Keil-App Backend API" });
});

// Error handling middleware
app.use(errorHandler);

export default app;
