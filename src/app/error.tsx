"use client";

import RouteErrorView, { type RouteErrorProps } from "@/components/RouteErrorView";

// Kök sınır: landing, giriş/kayıt ve kendi sınırı olmayan segmentler
export default function RootError(props: RouteErrorProps) {
  return <RouteErrorView {...props} className="landing-theme min-h-dvh" />;
}
