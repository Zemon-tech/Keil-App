import axios, { type InternalAxiosRequestConfig } from "axios";
import { supabase } from "./supabase";

/**
 * Axios instance configured with the base API URL and default headers.
 * Used for all authenticated and unauthenticated backend requests.
 */
const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/$/, "") + "/",
    headers: {
        "Content-Type": "application/json",
    },
});

/**
 * Request interceptor that automatically attaches the Supabase access token (JWT)
 * to the Authorization header for every outgoing request.
 * 
 * @param config - Axios request configuration
 * @returns Modified Axios request configuration
 */
api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }

        // Attach unique browser session ID and platform info
        let browserId = localStorage.getItem("keil_browser_id");
        if (!browserId) {
            browserId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem("keil_browser_id", browserId);
        }
        config.headers["X-Browser-Id"] = browserId;
        config.headers["X-Platform"] = navigator.platform || "";

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401 && error.response?.data?.code === "SESSION_REVOKED") {
            // Dispatch event to log out the user from AuthContext
            window.dispatchEvent(new CustomEvent("keil-session-revoked"));
        }
        return Promise.reject(error);
    }
);

export default api;
