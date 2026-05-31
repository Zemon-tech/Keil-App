import pino from "pino";
import { config } from "../config";
import { loggerContext } from "./logger-context";

const isProduction = config.env === "production";

const transports: pino.TransportTargetOptions[] = [];

if (isProduction && config.grafanaLokiHost) {
    transports.push({
        target: "pino-loki",
        options: {
            batching: true,
            interval: 5,
            host: config.grafanaLokiHost,
            basicAuth: {
                username: config.grafanaLokiUser,
                password: config.grafanaLokiPassword,
            },
            labels: { app: "keilhq-backend", env: "production" },
        },
        level: "info",
    });
}

if (!isProduction) {
    transports.push({
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
        },
        level: "debug",
    });
}

// Dynamic mixin to inject active request/user context
const mixin = () => {
    const store = loggerContext.getStore();
    return store ? { requestId: store.requestId, userId: store.userId } : {};
};

// Fallback: if production but no Loki configured, log JSON to stdout
// (container platforms like Sevalla/Lightsail capture stdout automatically)
const logger = transports.length > 0
    ? pino(
        {
            level: config.logLevel as string,
            mixin,
            redact: {
                paths: [
                    "req.headers.authorization",
                    "req.headers.cookie",
                    "*.password",
                    "*.token",
                    "*.secret",
                    "*.access_token",
                    "*.refresh_token",
                ],
                censor: "[REDACTED]",
            },
        },
        pino.transport({ targets: transports }),
    )
    : pino({
        level: config.logLevel as string,
        mixin,
        redact: {
            paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "*.password",
                "*.token",
                "*.secret",
                "*.access_token",
                "*.refresh_token",
            ],
            censor: "[REDACTED]",
        },
    });

export default logger;

/**
 * Create a child logger scoped to a specific service/subsystem.
 * Use this in services, workers, and socket handlers for easy filtering in Grafana.
 *
 * @example
 * const log = createServiceLogger('gcal');
 * log.info({ userId }, 'Sync started');
 */
export const createServiceLogger = (service: string) => logger.child({ service });
