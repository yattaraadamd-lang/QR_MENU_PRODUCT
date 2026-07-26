"use client";

import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  count?: number;
  gap?: number;
}

export default function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 10,
  count = 1,
  gap = 8,
}: SkeletonProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ width, height, borderRadius }}
        />
      ))}
    </div>
  );
}
