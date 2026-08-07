/**
 * Prisma Runtime Module for Socket.IO Server
 * 
 * CommonJS module for use in server.js production runtime.
 * Creates a singleton Prisma client that can be safely required
 * by Node.js without TypeScript compilation.
 */

const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__socketPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__socketPrisma = prisma;
}

module.exports = { prisma };
