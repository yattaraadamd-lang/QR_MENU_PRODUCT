"use client";

import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

export const stagger = (gap = 0.08, delay = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

// Kaydırıldığında bir kez görünür olan sarmalayıcı
export function Reveal({ children, delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: fadeUp.hidden,
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT, delay } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Çocuklarını sırayla gösteren grup; çocuklar `variants={fadeUp}` kullanmalı
export function RevealGroup({ children, gap = 0.08, ...props }: HTMLMotionProps<"div"> & { gap?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger(gap)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Fare imlecini takip eden 3D eğim. Dokunmatik cihazlarda ve
// "hareketi azalt" tercihinde düz kalır.
export function Tilt({
  children,
  max = 10,
  style,
  ...props
}: HTMLMotionProps<"div"> & { max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 180, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), spring);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={{
        rotateX: reduce ? 0 : rotateX,
        rotateY: reduce ? 0 : rotateY,
        transformPerspective: 1100,
        transformStyle: "preserve-3d",
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
