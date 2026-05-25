import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../lib/logger";

/**
 * Attach a unique request ID to every incoming request.
 * If the client sends an `x-request-id` header, it is reused (useful for tracing across services).
 * Otherwise a new UUID is generated.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
    (req as any).requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
};

/**
 * Structured HTTP request/response logger.
 * Logs method, URL, status code, duration, and user context on every response.
 * Uses appropriate log level based on status code.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

        logger[level]({
            requestId: (req as any).requestId,
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            userId: (req as any).user?.id,
        }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
};
