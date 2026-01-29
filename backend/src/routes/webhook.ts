import express from "express";
import { z } from "zod";
import { handleIncomingMessage } from "../services/botLogic";
import { validateTwilioRequest } from "../services/twilio";
import twilio from "twilio";

export const webhookRouter = express.Router();

const webhookSchema = z.object({
  From: z.string().min(1),
  Body: z.string().optional(),
  NumMedia: z.string().optional(),
  MediaUrl0: z.string().optional(),
  MediaContentType0: z.string().optional()
});

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

webhookRouter.post("/whatsapp", async (req, res) => {
  try {
    const signature = req.header("X-Twilio-Signature") || "";
    const baseUrl = process.env.WEBHOOK_BASE_URL || "";
    if (!baseUrl) {
      return res.status(500).json({ error: "Server misconfigured" });
    }
    const url = `${baseUrl.replace(/\/$/, "")}${req.originalUrl}`;

    // Validate Twilio webhook signature before trusting any payload.
    const params = req.body as Record<string, string>;
    const isValid = validateTwilioRequest(signature, url, params);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid signature" });
    }

    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const payload = parsed.data;
    const result = await handleIncomingMessage({
      from: payload.From,
      body: payload.Body,
      numMedia: toNumber(payload.NumMedia),
      mediaUrl: payload.MediaUrl0
    });

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(result.reply);

    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
