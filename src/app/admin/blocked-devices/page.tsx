import type { Metadata } from "next";
import BlockedDevicesScreen from "@/components/blocked-devices/BlockedDevicesScreen";

export const metadata: Metadata = { title: "Engelli Cihazlar" };

export default function BlockedDevicesPage() {
  return <BlockedDevicesScreen />;
}
