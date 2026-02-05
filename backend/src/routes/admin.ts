import express, { NextFunction, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { sendBotMessage, sendWhatsAppMessage } from "../services/twilio";
import {
  createAdmin,
  getAdminByEmail,
  getAdminById,
  getConversationByUserId,
  getUserById,
  getLatestPaymentByUserId,
  getPaymentById,
  listUnverifiedPayments,
  listUsers,
  rejectPayment,
  setPaymentVerifiedNotified,
  setPaymentVerifiedNotifyError,
  setUserReadingOutcome,
  updateConversation,
  updateAdminPassword,
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

const serviceTypeSchema = z.enum(["life_forecast", "destiny_readings"]);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
  email: z.string().email().optional()
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8)
});

function requireAdminToken(req: Request, res: Response, next: NextFunction) {
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

interface AdminJwtPayload extends JwtPayload {
  admin_id: string;
  email: string;
  token_version: number;
}

interface AdminAuthContext {
  adminId?: string;
  email?: string;
  tokenVersion?: number;
  usedAdminToken: boolean;
}

interface AdminAuthRequest extends Request {
  adminAuth?: AdminAuthContext;
}

function requireJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
}

async function requireAdminAuth(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
) {
  const headerToken = req.header("X-Admin-Token");
  const authHeader = req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;
  const token = (headerToken || bearerToken || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();

  if (expected && token === expected) {
    req.adminAuth = { usedAdminToken: true };
    return next();
  }

  if (!bearerToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(bearerToken, requireJwtSecret()) as AdminJwtPayload;
    if (!payload?.admin_id || !payload?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const admin = await getAdminById(payload.admin_id);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (admin.token_version !== payload.token_version) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.adminAuth = {
      adminId: admin.id,
      email: admin.email,
      tokenVersion: admin.token_version,
      usedAdminToken: false
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function signAdminToken(
  admin: { id: string; email: string; token_version: number }
) {
  return jwt.sign(
    {
      admin_id: admin.id,
      email: admin.email,
      token_version: admin.token_version
    },
    requireJwtSecret(),
    { expiresIn: "12h" }
  );
}

adminRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const admin = await getAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(parsed.data.password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signAdminToken(admin);
    return res.json({
      token,
      force_password_change: admin.force_password_change
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.post(
  "/change-password",
  requireAdminAuth,
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const auth = req.adminAuth;
      let admin =
        auth?.adminId ? await getAdminById(auth.adminId) : null;

      if (!admin) {
        const email = parsed.data.email?.trim().toLowerCase();
        if (!email) {
          return res.status(400).json({ error: "Missing admin email" });
        }
        admin = await getAdminByEmail(email);
      }

      if (!admin) {
        return res.status(404).json({ error: "Admin not found" });
      }

      const ok = await bcrypt.compare(
        parsed.data.oldPassword,
        admin.password_hash
      );
      if (!ok) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const nextTokenVersion = admin.token_version + 1;
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await updateAdminPassword(
        admin.id,
        passwordHash,
        false,
        nextTokenVersion
      );

      const token = signAdminToken({
        id: admin.id,
        email: admin.email,
        token_version: nextTokenVersion
      });

      return res.json({ token, force_password_change: false });
    } catch (error) {
      return res.status(500).json({ error: "Server error" });
    }
  }
);

adminRouter.post("/reset-password", requireAdminToken, async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const existing = await getAdminByEmail(email);

    if (!existing) {
      await createAdmin(email, passwordHash, true);
      return res.json({ ok: true });
    }

    await updateAdminPassword(
      existing.id,
      passwordHash,
      true,
      existing.token_version + 1
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

const PAYMENT_VERIFIED_MESSAGE =
  "✅ Payment verified successfully. Your reading is now being prepared. You'll receive your outcome here soon.";

adminRouter.post("/verify/:userId", requireAdminAuth, async (req: Request, res: Response) => {
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

    const payment = await getLatestPaymentByUserId(userId);
    const alreadyNotified = payment?.payment_verified_notified === true;

    await verifyLatestPayment(userId);
    await updateUserStatus(userId, UserStatus.VERIFIED);

    const conversation = await getConversationByUserId(userId);
    if (conversation) {
      await updateConversation(conversation.id, {
        current_step: ConversationStep.VERIFIED_NOTIFIED
      });
    }

    if (!alreadyNotified) {
      const result = await sendBotMessage(user.phone, PAYMENT_VERIFIED_MESSAGE, {
        userId,
        action: "payment_verified"
      });
      if (result.success) {
        await setPaymentVerifiedNotified(userId);
      } else {
        await setPaymentVerifiedNotifyError(userId, result.error ?? "Unknown error");
        console.error("[verify] Bot notification failed for user", userId, result.error);
        return res.status(502).json({ error: "Verification saved but failed to send user message" });
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("[verify] Error:", error);
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

adminRouter.post("/reject/:userId", requireAdminAuth, async (req: Request, res: Response) => {
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

const sendReadingOutcomeSchema = z.object({
  text: z.string().min(1).max(100000),
  forceResend: z.boolean().optional()
});

adminRouter.post(
  "/send-reading-outcome/:userId",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const parsedId = idSchema.safeParse(req.params.userId);
      if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      const parsedBody = sendReadingOutcomeSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ error: "Invalid body: text required" });
      }

      const userId = parsedId.data;
      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userWithReading = user as typeof user & {
        reading_sent?: boolean;
      };
      if (userWithReading.reading_sent && !parsedBody.data.forceResend) {
        return res.status(409).json({
          error: "Reading already sent",
          code: "ALREADY_SENT"
        });
      }

      const text = parsedBody.data.text.trim();
      const result = await sendBotMessage(user.phone, text, {
        userId,
        action: "reading_outcome"
      });

      const now = new Date().toISOString();
      if (result.success) {
        await updateUserStatus(userId, UserStatus.COMPLETED);
        const conversation = await getConversationByUserId(userId);
        if (conversation) {
          await updateConversation(conversation.id, {
            current_step: ConversationStep.COMPLETED
          });
        }
        await setUserReadingOutcome(userId, {
          reading_outcome_text: text,
          reading_sent: true,
          reading_sent_at: now,
          reading_send_error: null
        });
        return res.json({ ok: true, sent: true });
      }

      await setUserReadingOutcome(userId, {
        reading_outcome_text: null,
        reading_sent: false,
        reading_sent_at: null,
        reading_send_error: result.error ?? "Send failed"
      });
      console.error("[send-reading-outcome] failed for user", userId, result.error);
      return res.status(502).json({ error: "Failed to send reading outcome", details: result.error });
    } catch (error) {
      console.error("[send-reading-outcome] Error:", error);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

adminRouter.post("/complete/:userId", requireAdminAuth, async (req: Request, res: Response) => {
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

adminRouter.get("/users", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const statusValue = typeof req.query.status === "string" ? req.query.status : undefined;
    const serviceTypeValue =
      typeof req.query.service_type === "string" ? req.query.service_type : undefined;
    const statusParsed = statusValue ? statusSchema.safeParse(statusValue) : undefined;
    const serviceTypeParsed = serviceTypeValue
      ? serviceTypeSchema.safeParse(serviceTypeValue)
      : undefined;
    if (statusParsed && !statusParsed.success) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (serviceTypeParsed && !serviceTypeParsed.success) {
      return res.status(400).json({ error: "Invalid service_type" });
    }

    const users = await listUsers(statusParsed?.data, serviceTypeParsed?.data);
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.get("/users/:userId/profile", requireAdminAuth, async (req: Request, res: Response) => {
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

adminRouter.get("/payments", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const verifiedParam =
      typeof req.query.verified === "string" ? req.query.verified : undefined;
    const serviceTypeParam =
      typeof req.query.service_type === "string" ? req.query.service_type : undefined;
    if (verifiedParam && verifiedParam !== "false") {
      return res.status(400).json({ error: "Invalid verified filter" });
    }
    const serviceTypeParsed = serviceTypeParam
      ? serviceTypeSchema.safeParse(serviceTypeParam)
      : undefined;
    if (serviceTypeParam && !serviceTypeParsed?.success) {
      return res.status(400).json({ error: "Invalid service_type" });
    }

    const payments = await listUnverifiedPayments(serviceTypeParsed?.data);
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

adminRouter.get(
  "/payments/:paymentId/screenshot",
  requireAdminAuth,
  async (req: Request, res: Response) => {
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
