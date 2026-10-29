"use client";

import RouteErrorView, { type RouteErrorProps } from "@/components/RouteErrorView";

// Layout'un içinde çizilir: kenar çubuğu yerinde kalır
export default function SuperAdminError(props: RouteErrorProps) {
  return <RouteErrorView {...props} />;
}
