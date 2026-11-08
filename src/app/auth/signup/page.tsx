import type { Metadata } from "next";
import SignupScreen from "@/components/auth/SignupScreen";

export const metadata: Metadata = { title: "İşletme Kaydı" };

export default function SignupPage() {
  return <SignupScreen />;
}
