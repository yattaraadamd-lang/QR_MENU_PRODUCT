import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

/** next-auth v4 App Router handler'ını `any` olarak döndürüyor; Next'in rota imzasıyla tiplenir */
type AuthRouteHandler = (
  request: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) => Promise<Response>;

const handler = NextAuth(authOptions) as AuthRouteHandler;

export { handler as GET, handler as POST };
