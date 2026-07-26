"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export default function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  showPasswordToggle = false,
  type,
  className = "",
  style,
  id,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = showPasswordToggle ? (showPassword ? "text" : "password") : type;
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-secondary)",
            display: "block",
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        {leftIcon && (
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          type={inputType}
          className={`input ${className}`.trim()}
          style={{
            ...(leftIcon ? { paddingLeft: 40 } : {}),
            ...(rightIcon || showPasswordToggle ? { paddingRight: 44 } : {}),
            ...(error ? { borderColor: "var(--danger)", boxShadow: "0 0 0 3px rgba(220,38,38,0.12)" } : {}),
            ...style,
          }}
          {...props}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {rightIcon && !showPasswordToggle && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 4, fontWeight: 500 }}>
          {error}
        </p>
      )}
    </div>
  );
}
