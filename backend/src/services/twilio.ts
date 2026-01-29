import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
const authToken = process.env.TWILIO_AUTH_TOKEN || "";
const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || "";

if (!accountSid || !authToken || !fromWhatsApp) {
  console.warn("Twilio credentials are missing. Check your environment.");
}

export const twilioClient = twilio(accountSid, authToken);

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

export async function sendWhatsAppMessage(to: string, body: string) {
  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  return twilioClient.messages.create({
    to: formattedTo,
    from: fromWhatsApp,
    body
  });
}
