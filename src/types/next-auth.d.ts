import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    businessId: string;
    businessName: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      businessId: string;
      businessName: string;
    };
    // ✅ P0-03 FIX: Add accessToken for socket authentication
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    businessId: string;
    businessName: string;
  }
}
