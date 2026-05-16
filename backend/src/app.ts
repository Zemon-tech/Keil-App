import express, { Express } from "express";
import cors from "cors";
import routes from "./routes/index";
import { config } from "./config";
import { errorHandler } from "./middlewares/error";
import { requestLogger } from "./middlewares/logger";

const app: Express = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:3000",
    config.frontendUrl,
].filter(Boolean);

// Middleware
app.use(requestLogger);
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
}));
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
