"use client";

import RouteErrorView, { type RouteErrorProps } from "@/components/RouteErrorView";

export default function MenuError(props: RouteErrorProps) {
  return (
    <RouteErrorView
      {...props}
      className="customer-theme min-h-dvh"
      title="Menü yüklenemedi"
      message="İnternet bağlantınızı kontrol edip tekrar deneyin. Sorun sürerse garsondan yardım isteyin."
    />
  );
}
