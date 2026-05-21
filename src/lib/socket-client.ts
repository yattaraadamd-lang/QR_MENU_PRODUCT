"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectToBusinessRoom(businessId: string) {
  const s = getSocket();
  
  if (!s.connected) {
    s.connect();
  }

  s.emit("join_business", businessId);
  console.log(`[Socket.IO] Joined business room: business_${businessId}`);
  
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
