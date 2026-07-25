/**
 * WiseUp Backend — Express API entry point.
 *
 * Serves the REST API for the WiseUp industrial tools store.
 * Proxies AI chat requests to the Python AI microservice.
 */
import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import morgan from "morgan";
import { categoriesRouter } from "./routes/categories";
import { productsRouter } from "./routes/products";
import { chatRouter } from "./routes/chat";
import { leadsRouter } from "./routes/leads";
import { adminRouter } from "./routes/admin";
import { authMiddleware } from "./middleware/authMiddleware";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

// ─── Middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(morgan("dev"));
app.use(express.json());
app.use(authMiddleware);
app.use("/images", express.static(path.join(__dirname, "../../images")));

// ─── Health check ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "wiseup-api", timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────────────────────
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/admin", adminRouter);

// ─── Error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔧 WiseUp API running on http://localhost:${PORT}`);
});

export default app;
