import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
const authToken = process.env.TWILIO_AUTH_TOKEN || "";
const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || "";

if (!accountSid || !authToken || !fromWhatsApp) {
  console.warn("Twilio credentials are missing. Check your environment.");
}

export const twilioClient = twilio(accountSid, authToken);

/** Max body length per WhatsApp message (Twilio limit 4096; use 4000 to be safe) */
const MAX_MESSAGE_LENGTH = 4000;

function chunkMessage(body: string): string[] {
  if (body.length <= MAX_MESSAGE_LENGTH) return [body];
  const chunks: string[] = [];
  let remaining = body;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }
    const slice = remaining.slice(0, MAX_MESSAGE_LENGTH);
    const lastNewline = slice.lastIndexOf("\n");
    const splitAt =
      lastNewline > MAX_MESSAGE_LENGTH / 2 ? lastNewline + 1 : MAX_MESSAGE_LENGTH;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

export interface SendBotMessageResult {
  success: boolean;
  error?: string;
}

/**
 * Send a message to the user via the bot channel (WhatsApp).
 * Validates recipient, supports long messages (chunking), logs outcome.
 */
export async function sendBotMessage(
  to: string,
  message: string,
  metadata?: { userId?: string; action?: string }
): Promise<SendBotMessageResult> {
  const toTrimmed = (to || "").trim();
  if (!toTrimmed) {
    const err = "sendBotMessage: missing recipient (to)";
    console.error(err);
    return { success: false, error: err };
  }

  const chunks = chunkMessage(message);
  const action = metadata?.action ?? "send";

  try {
    for (let i = 0; i < chunks.length; i++) {
      await sendWhatsAppMessage(toTrimmed, chunks[i]);
      if (chunks.length > 1) {
        console.log(`[sendBotMessage] ${action} chunk ${i + 1}/${chunks.length} to ${toTrimmed}`);
      }
    }
    console.log(`[sendBotMessage] ${action} success to ${toTrimmed} (${chunks.length} msg(s))`);
    return { success: true };
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error(`[sendBotMessage] ${action} failed to ${toTrimmed}:`, errMessage);
    return { success: false, error: errMessage };
  }
}

export function validateTwilioRequest(
  signature: string | undefined,
  url: string,
  params: Record<string, string>
) {
  if (!signature) {
    return false;
  }
  return twilio.validateRequest(authToken, signature, url, params);
}

/** Ensure WhatsApp channel format for Twilio (from or to address). */
function formatWhatsAppAddress(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.toLowerCase().startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

export async function sendWhatsAppMessage(to: string, body: string) {
  const formattedTo = formatWhatsAppAddress(to);
  const formattedFrom = formatWhatsAppAddress(fromWhatsApp);
  if (!formattedFrom) {
    throw new Error("TWILIO_WHATSAPP_FROM is not set or empty. Set it to your Twilio WhatsApp number, e.g. whatsapp:+14155238886 or +14155238886");
  }
  return twilioClient.messages.create({
    to: formattedTo,
    from: formattedFrom,
    body
  });
}
