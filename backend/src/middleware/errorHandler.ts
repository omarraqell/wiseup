/**
 * Centralized error handler middleware.
 */
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("❌ Unhandled error:", err.message);
  console.error(err.stack);

  const status = (err as any).status || 500;
  res.status(status).json({
    error: {
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
}
