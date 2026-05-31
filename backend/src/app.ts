import express, { Express } from "express";
import cors from "cors";
import routes from "./routes/index";
import { config } from "./config";
import { errorHandler } from "./middlewares/error";
import { requestIdMiddleware, requestLogger } from "./middlewares/logger";
import { MastraServer } from "@mastra/express";
import { mastra } from "./mastra";

const app: Express = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:3000",
    "https://app.keilhq.in",
    config.frontendUrl,
].filter(Boolean);

// Middleware
app.use(requestIdMiddleware);
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Routes
app.use("/api", routes);

// Base route for testing
app.get("/", (_req, res) => {
    res.json({ message: "Welcome to the Keil-App Backend API" });
});

// ─── Mastra Server (async init) ───────────────────────────────────────────────
// MastraServer registers routes (like /api/chat) on the Express app.
// Error handler is added AFTER init so Mastra routes are matched first.

let _mastraServer: MastraServer | null = null;

export async function initMastraServer(): Promise<void> {
    _mastraServer = new MastraServer({
        app,
        mastra,
        streamOptions: { redact: false },
    });
    await _mastraServer.init();

    // Error handler must be last — after all routes (including Mastra's) are registered
    app.use(errorHandler);
}

export default app;
