"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  variant?: "fade-up" | "fade-down" | "fade-left" | "fade-right" | "zoom-in" | "zoom-out";
  duration?: number; // in ms
  delay?: number; // in ms
  threshold?: number; // 0 to 1
  once?: boolean;
  className?: string;
}

export default function ScrollReveal({
  children,
  variant = "fade-up",
  duration = 700,
  delay = 0,
  threshold = 0.1,
  once = true,
  className = "",
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(entry.target);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, once]);

  const getVariantStyles = () => {
    switch (variant) {
      case "fade-up":
        return isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8";
      case "fade-down":
        return isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8";
      case "fade-left":
        return isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8";
      case "fade-right":
        return isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8";
      case "zoom-in":
        return isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95";
      case "zoom-out":
        return isVisible ? "opacity-100 scale-100" : "opacity-0 scale-105";
      default:
        return isVisible ? "opacity-100" : "opacity-0";
    }
  };

  return (
    <div
      ref={ref}
      className={`transition-all ease-out ${getVariantStyles()} ${className}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
