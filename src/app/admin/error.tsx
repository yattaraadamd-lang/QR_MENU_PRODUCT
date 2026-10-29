"use client";

import RouteErrorView, { type RouteErrorProps } from "@/components/RouteErrorView";

// Layout'un içinde çizilir: kenar çubuğu ve bildirimler yerinde kalır
export default function AdminError(props: RouteErrorProps) {
  return <RouteErrorView {...props} />;
}
