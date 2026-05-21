// src/lib/socket.ts

import { io, Socket } from "socket.io-client";

// This variable lives for the LIFETIME of the browser tab.
// It's not tied to any component render cycle.
let socket: Socket | null = null;

/**
 * Call this right after the user logs in.
 * Pass the Supabase JWT token so the server can verify who this is.
 *
 * Safe to call multiple times — if already connected, returns the same socket.
 */
export function connectSocket(token: string): Socket {
  // If already instantiated, update the auth token for subsequent connection attempts.
  // AuthContext calls this on every session event/refresh, keeping the socket credential fresh.
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5001", {
    auth: { token }, // Server reads this in the auth middleware
  });

  return socket;
}

/**
 * Call this right before the user logs out.
 * ⚠️ Must be called BEFORE supabase.auth.signOut() — otherwise the JWT
 * is already cleared and the server can't cleanly close the session.
 */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null; // Reset so connectSocket() can create a fresh one next login
}

/**
 * Use this inside hooks/components to send/receive events.
 * Returns null if the user isn't logged in yet.
 */
export function getSocket(): Socket | null {
  return socket;
}
