import express from "express";
import { z } from "zod";
import { sendWhatsAppMessage } from "../services/twilio";
import {
  getConversationByUserId,
  getUserById,
  getLatestPaymentByUserId,
  getPaymentById,
  listUnverifiedPayments,
  listUsers,
  rejectPayment,
  updateConversation,
  updateUserStatus,
  verifyLatestPayment
} from "../services/supabase";
import { ConversationStep, UserStatus } from "../utils/states";
import { messages } from "../utils/messages";

export const adminRouter = express.Router();

const idSchema = z.string().uuid();
const statusSchema = z.enum([
  UserStatus.NEW,
  UserStatus.AWAITING_PAYMENT,
  UserStatus.PAYMENT_SUBMITTED,
  UserStatus.VERIFIED,
  UserStatus.COMPLETED
]);

function requireAdminToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Token auth for admin endpoints.
  const headerToken = req.header("X-Admin-Token");
  const authHeader = req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;
  const token = (headerToken || bearerToken || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();

  if (!expected || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

adminRouter.post("/verify/:userId", requireAdminToken, async (req, res) => {
  try {
    const parsed = idSchema.safeParse(req.params.userId);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userId = parsed.data;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await verifyLatestPayment(userId);
    await updateUserStatus(userId, UserStatus.VERIFIED);

    const conversation = await getConversationByUserId(userId);
    if (conversation) {
      await updateConversation(conversation.id, {
        current_step: ConversationStep.VERIFIED_NOTIFIED
      });
    }

    await sendWhatsAppMessage(user.phone, messages.paymentVerified);

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

const rejectSchema = z.object({
  reason: z.enum(["INVALID_PROOF", "UNDERPAID"]),
  note: z.string().max(500).optional(),
  receivedAmountGhs: z.number().positive().optional()
});

function expectedAmountFromPlan(plan: string | null): number | null {
  if (!plan) return null;
  if (plan === "1 Year") return 1800;
  if (plan === "3 Years") return 3000;
  if (plan === "5 Years") return 4200;
  return null;
}

adminRouter.post("/reject/:userId", requireAdminToken, async (req, res) => {
  try {
    const parsedId = idSchema.safeParse(req.params.userId);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const parsedBody = rejectSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const userId = parsedId.data;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const conversation = await getConversationByUserId(userId);
    if (conversation) {
      await updateConversation(conversation.id, {
        current_step: ConversationStep.PAYMENT_ISSUE_MENU
      });
    }

    await updateUserStatus(userId, UserStatus.AWAITING_PAYMENT);

    if (parsedBody.data.reason === "INVALID_PROOF") {
      await rejectPayment(userId, {
        rejection_reason: "INVALID_PROOF",
        rejection_note: parsedBody.data.note || null,
        received_amount_ghs: null,
        expected_amount_ghs: null
      });

      try {
        await sendWhatsAppMessage(user.phone, messages.paymentRejectedInvalid);
      } catch (twilioError) {
        console.error("Twilio send failed (INVALID_PROOF):", twilioError);
        return res.status(502).json({ error: "Failed to send message" });
      }
      return res.json({ ok: true });
    }

    const expectedAmount = expectedAmountFromPlan(user.selected_plan);
    if (!expectedAmount) {
      return res.status(400).json({ error: "Missing or invalid plan" });
    }
    if (!parsedBody.data.receivedAmountGhs) {
      return res.status(400).json({ error: "Missing received amount" });
    }

    await rejectPayment(userId, {
      rejection_reason: "UNDERPAID",
      rejection_note: parsedBody.data.note || null,
      received_amount_ghs: parsedBody.data.receivedAmountGhs,
      expected_amount_ghs: expectedAmount
    });

    const message = messages.paymentRejectedUnderpaid
      .replace("{expectedAmount}", expectedAmount.toString())
      .replace(
        "{receivedAmount}",
        parsedBody.data.receivedAmountGhs.toString()
      );
    try {
      await sendWhatsAppMessage(user.phone, message);
    } catch (twilioError) {
      console.error("Twilio send failed (UNDERPAID):", twilioError);
      return res.status(502).json({ error: "Failed to send message" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.post("/complete/:userId", requireAdminToken, async (req, res) => {
  try {
    const parsed = idSchema.safeParse(req.params.userId);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userId = parsed.data;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await updateUserStatus(userId, UserStatus.COMPLETED);

    const conversation = await getConversationByUserId(userId);
    if (conversation) {
      await updateConversation(conversation.id, {
        current_step: ConversationStep.COMPLETED
      });
    }

    try {
      await sendWhatsAppMessage(user.phone, messages.completed);
    } catch (twilioError) {
      console.error("Twilio send failed (COMPLETED):", twilioError);
      return res.status(502).json({ error: "Failed to send message" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.get("/users", requireAdminToken, async (req, res) => {
  try {
    const statusValue = typeof req.query.status === "string" ? req.query.status : undefined;
    const parsed = statusValue ? statusSchema.safeParse(statusValue) : undefined;
    if (parsed && !parsed.success) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const users = await listUsers(parsed?.data);
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.get("/users/:userId/profile", requireAdminToken, async (req, res) => {
  try {
    const parsed = idSchema.safeParse(req.params.userId);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userId = parsed.data;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const conversation = await getConversationByUserId(userId);
    const latestPayment = await getLatestPaymentByUserId(userId);

    return res.json({ user, conversation, latestPayment });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.get("/payments", requireAdminToken, async (req, res) => {
  try {
    const verifiedParam =
      typeof req.query.verified === "string" ? req.query.verified : undefined;
    if (verifiedParam && verifiedParam !== "false") {
      return res.status(400).json({ error: "Invalid verified filter" });
    }

    const payments = await listUnverifiedPayments();
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.get(
  "/payments/:paymentId/screenshot",
  requireAdminToken,
  async (req, res) => {
    try {
      const parsed = idSchema.safeParse(req.params.paymentId);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payment ID" });
      }

      const payment = await getPaymentById(parsed.data);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const url = payment.screenshot_url;
      if (!url) {
        return res.status(404).json({ error: "Screenshot not found" });
      }

      const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
      const authToken = process.env.TWILIO_AUTH_TOKEN || "";
      if (!accountSid || !authToken) {
        return res.status(500).json({ error: "Server misconfigured" });
      }

      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString(
        "base64"
      );

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${authHeader}`
        }
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch media" });
      }

      const contentType =
        response.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();

      res.setHeader("Content-Type", contentType);
      return res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      return res.status(500).json({ error: "Server error" });
    }
  }
);
