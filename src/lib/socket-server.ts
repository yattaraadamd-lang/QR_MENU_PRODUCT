// Socket.IO server-side emit helper
// Custom server (server.js) global.__socketIO üzerinden io instance'ını paylaşır

declare global {
  var __socketIO: any;
}

export function emitToBusinessRoom(businessId: string, event: string, data: any) {
  const io = global.__socketIO;
  if (io) {
    io.to(`business_${businessId}`).emit(event, data);
    console.log(`[Socket.IO] Emitted "${event}" to business_${businessId}`);
  } else {
    console.log(`[Socket.IO] No io instance available, skipping emit for "${event}"`);
  }
}
