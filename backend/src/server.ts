import express from "express";
import { webhookRouter } from "./routes/webhook";
import { adminRouter } from "./routes/admin";

export function createServer() {
  const app = express();

  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const allowedOrigins = new Set([
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ]);
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Admin-Token"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use("/webhook", webhookRouter);
  app.use("/admin", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}
