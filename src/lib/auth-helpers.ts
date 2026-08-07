export {
  requireAuth,
  requireAdmin,
  requireWaiterOrAdmin,
  requireWaiter,
  requireSuperAdmin,
  getBusinessId,
} from "./auth-guard";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getAuthSession() {
  return await getServerSession(authOptions);
}
