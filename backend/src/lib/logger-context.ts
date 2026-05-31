import { AsyncLocalStorage } from "async_hooks";

export interface LogContext {
    requestId: string;
    userId?: string;
    [key: string]: any;
}

export const loggerContext = new AsyncLocalStorage<LogContext>();

/**
 * Update key-value pairs in the active request context dynamically
 * (e.g. setting userId after user authentication succeeds).
 */
export const setInLogContext = (key: keyof LogContext, value: any) => {
    const store = loggerContext.getStore();
    if (store) {
        store[key] = value;
    }
};
