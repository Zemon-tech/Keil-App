import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const error = err as any;
    const statusCode = error.statusCode || 500;
    const requestId = (req as any).requestId;

    logger.error({
        requestId,
        err: error,
        method: req.method,
        url: req.originalUrl,
        userId: (req as any).user?.id,
        statusCode,
    }, error.message || "Internal Server Error");

    res.status(statusCode).json({
        status: "error",
        statusCode,
        message: error.message || "Internal Server Error",
        requestId,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
};
