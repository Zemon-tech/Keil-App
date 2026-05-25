# Logging Implementation Plan

> **Goal**: Replace all raw `console.log/error/warn` calls with structured Pino logging, add request correlation IDs, ship logs to Grafana Cloud Loki, and integrate Sentry for frontend error monitoring.

## Current State

| Area | Current Approach | Issues |
|------|-----------------|--------|
| Backend request logging | `console.log` in `middlewares/logger.ts` | No structure, no request IDs, no JSON |
| Error handling | `console.error` in `middlewares/error.ts` | No context, no correlation |
| Workers (overdue, notifications) | `console.log/error` with `[tag]` prefix | Not queryable, no levels |
| Google Calendar sync | Heavy `console.log` with `[gcal]` tag | Verbose, no filtering in prod |
| Socket.io | `console.log/error` with emoji + `[socket]` | No user context in structured form |
| Auth controller | **Only file using Pino** (local instance) | Isolated, not shared |
| Frontend | No error monitoring | Silent failures in production |

**Dependencies already installed**: `pino@10.3.1`, `pino-pretty@13.1.3`

---

## Architecture Decision

```
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Node.js)                         │
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────────┐ │
│  │  Pino    │───▶│ pino-loki    │───▶│  Grafana Cloud Loki    │ │
│  │  Logger  │    │ (transport)  │    │  (50 GB/mo free)       │ │
│  └──────────┘    └──────────────┘    └────────────────────────┘ │
│       │                                                          │
│       │ (dev only)                                               │
│       ▼                                                          │
│  ┌──────────────┐                                                │
│  │ pino-pretty  │ → colorized terminal output                    │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Why this approach?

- **Pino + Grafana Cloud Loki**: Pino is already installed, outputs structured JSON, and `pino-loki` ships logs directly to Grafana Cloud without needing a sidecar agent. Grafana Cloud free tier gives 50 GB/month with 14-day retention — more than enough for a B2B app.

---

## Phase 1: Core Logger Module & Configuration

**Duration**: ~2 hours  
**Files to create/modify**: 3 new, 1 modified

### Tasks

1. **Add `LOG_LEVEL` and Grafana Cloud env vars to config**

   File: `backend/src/config/index.ts`

   ```typescript
   // Add to config object:
   logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
   grafanaLokiHost: process.env.GRAFANA_LOKI_HOST || '',
   grafanaLokiUser: process.env.GRAFANA_LOKI_USER || '',
   grafanaLokiPassword: process.env.GRAFANA_LOKI_PASSWORD || '',
   ```

2. **Create centralized logger module**

   File: `backend/src/lib/logger.ts`

   ```typescript
   import pino from 'pino';
   import { config } from '../config';

   const isProduction = config.env === 'production';

   const transports: pino.TransportMultiOptions['targets'] = [];

   if (isProduction && config.grafanaLokiHost) {
     transports.push({
       target: 'pino-loki',
       options: {
         batching: true,
         interval: 5, // seconds
         host: config.grafanaLokiHost,
         basicAuth: {
           username: config.grafanaLokiUser,
           password: config.grafanaLokiPassword,
         },
         labels: { app: 'keilhq-backend', env: 'production' },
       },
       level: 'info',
     });
   }

   if (!isProduction) {
     transports.push({
       target: 'pino-pretty',
       options: {
         colorize: true,
         translateTime: 'SYS:HH:MM:ss',
         ignore: 'pid,hostname',
       },
       level: 'debug',
     });
   }

   // Fallback: if production but no Loki configured, log JSON to stdout
   // (container platforms like Sevalla/Lightsail capture stdout automatically)
   const logger = transports.length > 0
     ? pino({ level: config.logLevel }, pino.transport({ targets: transports }))
     : pino({ level: config.logLevel });

   export default logger;
   ```

3. **Install `pino-loki`**

   ```bash
   cd backend && npm install pino-loki@2
   ```

4. **Create child logger factory for services**

   File: `backend/src/lib/logger.ts` (append)

   ```typescript
   // Named child loggers for each subsystem
   export const createServiceLogger = (service: string) => logger.child({ service });
   ```

### Environment Variables to Add

| Variable | Example Value | Where |
|----------|--------------|-------|
| `LOG_LEVEL` | `info` | Sevalla/Lightsail env |
| `GRAFANA_LOKI_HOST` | `https://logs-prod-XXX.grafana.net` | Sevalla/Lightsail env |
| `GRAFANA_LOKI_USER` | `123456` (Grafana Cloud user ID) | Sevalla/Lightsail env |
| `GRAFANA_LOKI_PASSWORD` | `glc_xxxxx...` (API token) | Sevalla/Lightsail env |

### Grafana Cloud Setup Steps

1. Sign up at [grafana.com/cloud](https://grafana.com/cloud) (free forever tier)
2. Go to **Connections → Loki** → note the push URL, user ID, and generate an API token
3. The host URL format: `https://logs-prod-XXX.grafana.net`
4. Add these as env vars in Sevalla and Lightsail dashboards

---

## Phase 2: Request Correlation & HTTP Logger

**Duration**: ~1.5 hours  
**Files to modify**: 2

### Tasks

1. **Add request ID middleware + structured HTTP logger**

   File: `backend/src/middlewares/logger.ts` (rewrite)

   ```typescript
   import { Request, Response, NextFunction } from 'express';
   import crypto from 'crypto';
   import logger from '../lib/logger';

   // Attach a unique request ID to every incoming request
   export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
     const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
     (req as any).requestId = requestId;
     res.setHeader('x-request-id', requestId);
     next();
   };

   // Structured HTTP request/response logger
   export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
     const start = Date.now();
     res.on('finish', () => {
       const duration = Date.now() - start;
       const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

       logger[level]({
         requestId: (req as any).requestId,
         method: req.method,
         url: req.originalUrl,
         status: res.statusCode,
         duration,
         ip: req.ip,
         userAgent: req.headers['user-agent'],
         userId: (req as any).user?.id,
       }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
     });
     next();
   };
   ```

2. **Update `app.ts` to use request ID middleware**

   File: `backend/src/app.ts`

   ```typescript
   import { requestIdMiddleware, requestLogger } from './middlewares/logger';

   // Add before other middleware:
   app.use(requestIdMiddleware);
   app.use(requestLogger);
   ```

### Sensitive Data Redaction

Pino supports built-in redaction. Add to logger config:

```typescript
const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
  // ... transport config
});
```

---

## Phase 3: Error Handler Migration

**Duration**: ~30 minutes  
**Files to modify**: 1

### Tasks

1. **Rewrite error handler with structured logging**

   File: `backend/src/middlewares/error.ts`

   ```typescript
   import { Request, Response, NextFunction } from 'express';
   import logger from '../lib/logger';

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
     }, error.message || 'Internal Server Error');

     res.status(statusCode).json({
       status: 'error',
       statusCode,
       message: error.message || 'Internal Server Error',
       requestId,
       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
     });
   };
   ```

---

## Phase 4: Service & Worker Migration

**Duration**: ~3 hours  
**Files to modify**: ~15-20 files

### Strategy

Replace all `console.log/error/warn` with child loggers. Each subsystem gets its own child logger for easy filtering in Grafana.

### Child Logger Mapping

| Current Tag | Child Logger | File(s) |
|-------------|-------------|---------|
| `[server]` | `logger.child({ service: 'server' })` | `index.ts` |
| `[database]` | `logger.child({ service: 'database' })` | `index.ts` |
| `[socket]` | `logger.child({ service: 'socket' })` | `socket.ts` |
| `[worker]` | `logger.child({ service: 'task-overdue-worker' })` | `task-overdue-worker.service.ts` |
| `[notification-worker]` | `logger.child({ service: 'notification-worker' })` | `notification-worker.service.ts` |
| `[gcal]` | `logger.child({ service: 'gcal' })` | `google-calendar.service.ts` |
| `[gcal-renewal]` | `logger.child({ service: 'gcal-renewal' })` | `gcal-watch-renewal.service.ts` |

### Migration Pattern

**Before:**
```typescript
console.log(`⏰ [worker]: Moved ${count} workspace tasks to backlog`);
console.error('❌ [worker]: Error checking overdue tasks:', error);
```

**After:**
```typescript
import { createServiceLogger } from '../lib/logger';
const log = createServiceLogger('task-overdue-worker');

log.info({ count, type: 'workspace' }, 'Moved tasks to backlog');
log.error({ err: error }, 'Error checking overdue tasks');
```

### Files to Migrate (in order)

1. `backend/src/index.ts` — server lifecycle
2. `backend/src/socket.ts` — WebSocket events
3. `backend/src/services/task-overdue-worker.service.ts`
4. `backend/src/services/notification-worker.service.ts`
5. `backend/src/services/gcal-watch-renewal.service.ts`
6. `backend/src/services/google-calendar.service.ts` (largest — ~30+ console calls)
7. `backend/src/controllers/auth.controller.ts` (replace local pino instance with shared logger)
8. All other services with `.catch(err => console.error(...))` patterns:
   - `task.service.ts`
   - `personal-task.service.ts`
   - `org-task.service.ts`
   - `motion-page.service.ts`
9. Any remaining controllers with console calls

### Log Level Guidelines

| Level | When to Use |
|-------|-------------|
| `fatal` | App cannot continue (DB connection failed on startup) |
| `error` | Operation failed, needs attention (unhandled exception, transaction failure) |
| `warn` | Recoverable issue (duplicate key, token refresh failed, degraded state) |
| `info` | Normal operations worth recording (server started, task moved, sync complete) |
| `debug` | Detailed flow for troubleshooting (skipping event, loop prevention, no-op decisions) |

### GCal Service Specific Guidance

The Google Calendar service has many `console.log` calls for sync decisions (skip, no-op, loop prevention). These should be `debug` level — they're useful for troubleshooting but noisy in production:

```typescript
// These become debug (not info):
log.debug({ eventId, reason: 'loop-prevention' }, 'Skipping event — originated from KeilHQ');
log.debug({ eventId, reason: 'past-event' }, 'Skipping event — in the past');
log.debug({ taskId, reason: 'up-to-date' }, 'Task already up-to-date — skipping write');
```

---

## Phase 5: Verification & Grafana Dashboard

**Duration**: ~1 hour

### Tasks

1. **Verify local development**
   - Run `npm run dev` — confirm pino-pretty output with colors
   - Make API requests — confirm structured request logs with requestId
   - Trigger an error — confirm error handler logs with full context

2. **Verify production shipping**
   - Deploy to staging/production
   - Open Grafana Cloud → Explore → Loki
   - Query: `{app="keilhq-backend"} | json`
   - Verify labels: `service`, `level`, `requestId`

3. **Create basic Grafana dashboard**
   - Panel 1: Log volume over time (by level)
   - Panel 2: Error rate (status >= 500)
   - Panel 3: Slow requests (duration > 1000ms)
   - Panel 4: Live log stream (filterable by service)

4. **Remove `@types/pino` from devDependencies**
   - Pino v10+ ships its own types — the `@types/pino` package is deprecated and may cause conflicts

---

## Phase 6: Cleanup & Documentation

**Duration**: ~30 minutes

### Tasks

1. **Grep for remaining `console.` calls**

   ```bash
   grep -r "console\." backend/src/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"
   ```

   Any remaining calls should be converted or explicitly justified.

2. **Update `AGENTS.md`** — Add logging conventions:
   - Always use `import logger from '../lib/logger'` or `createServiceLogger`
   - Never use `console.log/error/warn` in production code
   - Use appropriate log levels
   - Include contextual data as first argument object

3. **Update `backend/.env.example`** with new variables

4. **Update `docs/infrastructure/backend-deployment.md`** with Grafana Cloud setup instructions

---

## Summary

| Phase | Scope | Duration | Dependencies |
|-------|-------|----------|-------------|
| 1 | Logger module + config + pino-loki install | ~2h | Grafana Cloud account |
| 2 | Request ID + HTTP logger middleware | ~1.5h | Phase 1 |
| 3 | Error handler migration | ~30m | Phase 1 |
| 4 | All services/workers/socket migration | ~3h | Phase 1 |
| 5 | Verification + Grafana dashboard | ~1h | Phases 1-4 deployed |
| 6 | Cleanup + docs | ~30m | Phase 5 |

**Total estimated time**: ~8.5 hours (focused sprint)

---

## Cost Summary

| Service | Free Tier | What You Get |
|---------|-----------|-------------|
| **Grafana Cloud** | 50 GB logs/month, 14-day retention | Loki log storage, dashboards, alerting |
| **pino-loki** | Open source | Direct log shipping (no sidecar needed) |

**Total monthly cost: $0** (within free tier)

---

## File Change Summary

### New Files
- `backend/src/lib/logger.ts`

### Modified Files
- `backend/src/config/index.ts` (add env vars)
- `backend/src/middlewares/logger.ts` (rewrite)
- `backend/src/middlewares/error.ts` (rewrite)
- `backend/src/app.ts` (add requestId middleware)
- `backend/src/index.ts` (replace console calls)
- `backend/src/socket.ts` (replace console calls)
- `backend/src/services/task-overdue-worker.service.ts`
- `backend/src/services/notification-worker.service.ts`
- `backend/src/services/gcal-watch-renewal.service.ts`
- `backend/src/services/google-calendar.service.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/services/task.service.ts`
- `backend/src/services/personal-task.service.ts`
- `backend/src/services/org-task.service.ts`
- `backend/src/services/motion-page.service.ts`
- `backend/package.json` (add pino-loki)

### New Dependencies
- `pino-loki@2` (backend — production dependency)

---

## Future Work: Frontend Error Monitoring

> **Planned for next implementation phase.**

The recommended approach for frontend is **Sentry** (`@sentry/react`):

- Purpose-built for client-side errors: source maps, breadcrumbs, session replay
- React-specific: component stack traces, error boundaries
- Free tier: 5K errors/month, 10K performance transactions/month
- Shipping frontend logs to Loki is not recommended — Sentry provides far better debugging UX for client-side issues

This will be covered in a separate implementation plan.
