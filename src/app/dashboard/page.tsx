import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Role'e göre yönlendir
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  } else {
    redirect("/waiter");
  }
}
