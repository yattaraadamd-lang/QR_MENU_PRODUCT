import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    businessId: string;
    businessName: string;
    sessionVersion: number;
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
    /** Girişteki User.sessionVersion; farklıysa oturum iptal edilmiştir */
    sv: number;
    /** Giriş anı (Unix saniye). Oturum yenilenince değişmez */
    authTime: number;
  }
}
