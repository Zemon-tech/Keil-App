import axios, { type InternalAxiosRequestConfig } from "axios";
import { supabase } from "./supabase";

/**
 * Axios instance configured with the base API URL and default headers.
 * Used for all authenticated and unauthenticated backend requests.
 */
const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "") + "/",
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

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
