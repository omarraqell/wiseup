/**
 * Chat API routes — proxies to the Python AI microservice.
 *
 * POST /api/chat       — send a message to the AI agent
 * POST /api/chat/reset — start a new conversation session
 */
import { Router } from "express";
import { ChatReqSchema, ChatResetSchema } from "../utils/validators";

export const chatRouter = Router();

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL ||
  (process.env.AI_SERVICE_HOSTPORT ? `http://${process.env.AI_SERVICE_HOSTPORT}` : "http://localhost:8000");

// Proxy chat request to Python AI microservice
chatRouter.post("/", async (req, res, next) => {
  try {
    // Validate request body
    const validation = ChatReqSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: { message: validation.error.errors[0].message } });
    }

    const { query, k, generate, session_id } = validation.data;

    const response = await fetch(`${AI_SERVICE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, k, generate, session_id }),
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Reset chat session
chatRouter.post("/reset", async (req, res, next) => {
  try {
    // Validate request body
    const validation = ChatResetSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: { message: validation.error.errors[0].message } });
    }

    const { session_id } = validation.data;

    const response = await fetch(`${AI_SERVICE_URL}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id }),
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});
