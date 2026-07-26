"use client";

import React from "react";

type BadgeVariant = "primary" | "accent" | "success" | "danger" | "warning" | "info" | "purple" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Badge({
  variant = "primary",
  dot = false,
  children,
  className = "",
  style,
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()} style={style}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
