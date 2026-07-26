"use client";

import React from "react";

type CardVariant = "default" | "flat" | "stat" | "glass";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
  padding?: string;
}

const variantMap: Record<CardVariant, string> = {
  default: "card",
  flat: "card-flat",
  stat: "stat-card",
  glass: "glass",
};

export default function Card({
  variant = "default",
  hover = true,
  padding,
  children,
  className = "",
  style,
  ...props
}: CardProps) {
  return (
    <div
      className={`${variantMap[variant]} ${className}`.trim()}
      style={{
        ...(padding ? { padding } : {}),
        ...(hover === false ? { pointerEvents: "auto" } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
