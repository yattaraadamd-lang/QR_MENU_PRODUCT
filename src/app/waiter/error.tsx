"use client";

import RouteErrorView, { type RouteErrorProps } from "@/components/RouteErrorView";

// Layout'un içinde çizilir: alt gezinme ve bildirimler yerinde kalır
export default function WaiterError(props: RouteErrorProps) {
  return <RouteErrorView {...props} />;
}
