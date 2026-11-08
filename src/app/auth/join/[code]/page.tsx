import type { Metadata } from "next";
import JoinScreen from "@/components/auth/JoinScreen";

export const metadata: Metadata = { title: "Ekip Daveti" };

export default function JoinPage() {
  return <JoinScreen />;
}
