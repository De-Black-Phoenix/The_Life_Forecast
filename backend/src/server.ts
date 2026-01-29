import express, { NextFunction, Request, Response } from "express";
import { webhookRouter } from "./routes/webhook";
import { adminRouter } from "./routes/admin";

export function createServer() {
  const app = express();

  app.disable("x-powered-by");

  // Minimal CORS support for the admin dashboard.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const allowedOrigin = (process.env.ADMIN_DASHBOARD_ORIGIN || "").trim();
    const origin = req.headers.origin;
    if (allowedOrigin && origin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Admin-Token"
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use("/webhook", webhookRouter);
  app.use("/admin", adminRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}
