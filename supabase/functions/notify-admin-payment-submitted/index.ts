import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmissionRow {
  id: string;
  user_id: string;
  conversation_id: string;
  payment_id: string;
  created_at: string;
  admin_notified: boolean;
  admin_notified_at: string | null;
}

interface UserRow {
  id: string;
  phone: string;
  service_type?: string;
  selected_plan?: string | null;
}

interface ConversationRow {
  collected_data: Record<string, unknown>;
}

interface PaymentRow {
  screenshot_url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const submissionId = body?.submission_id;
    if (!submissionId || typeof submissionId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing submission_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    const dashboardUrl = Deno.env.get("DASHBOARD_BASE_URL") ?? "";

    if (!sendgridKey || !fromEmail || !adminEmail) {
      console.error("Missing SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, or ADMIN_NOTIFICATION_EMAIL");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (subErr) {
      console.error("Fetch submission error:", subErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch submission" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!submission) {
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const row = submission as SubmissionRow;
    if (row.admin_notified) {
      return new Response(
        JSON.stringify({ ok: true, message: "Already notified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [{ data: userData, error: userErr }, { data: convData, error: convErr }, { data: payData, error: payErr }] = await Promise.all([
      supabase.from("users").select("id, phone, service_type, selected_plan").eq("id", row.user_id).maybeSingle(),
      supabase.from("conversations").select("collected_data").eq("id", row.conversation_id).maybeSingle(),
      supabase.from("payments").select("screenshot_url").eq("id", row.payment_id).maybeSingle(),
    ]);

    if (userErr || convErr || payErr) {
      console.error("Fetch related data error:", userErr || convErr || payErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch submission details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = (userData as UserRow) ?? {};
    const conv = (convData as ConversationRow) ?? {};
    const pay = (payData as PaymentRow) ?? {};
    const data = conv.collected_data ?? {};
    const serviceLabel = user.service_type === "destiny_readings" ? "Destiny Readings" : "Life Forecast";
    const fullName = (data.full_name as string) ?? "—";
    const phone = user.phone ?? "—";
    const paymentEvidenceUrl = pay.screenshot_url ?? "—";
    const submissionIdStr = row.id;
    const createdAt = row.created_at;
    const dashboardLink = dashboardUrl ? `${dashboardUrl.replace(/\/$/, "")}` : "—";

    const emailBody = [
      "New final submission (details + payment evidence received).",
      "",
      "Service type: " + serviceLabel,
      "User name: " + fullName,
      "Phone / WhatsApp: " + phone,
      "Email: N/A (not collected)",
      "Payment evidence URL: " + paymentEvidenceUrl,
      "Submission ID: " + submissionIdStr,
      "Created at: " + createdAt,
      "Dashboard: " + dashboardLink,
    ].join("\n");

    const sendgridRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + sendgridKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: adminEmail }] }],
        from: { email: fromEmail, name: "Life Forecast Bot" },
        subject: `[${serviceLabel}] New submission: ${fullName} (${phone})`,
        content: [{ type: "text/plain", value: emailBody }],
      }),
    });

    if (!sendgridRes.ok) {
      const errText = await sendgridRes.text();
      console.error("SendGrid error:", sendgridRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await supabase
      .from("submissions")
      .update({
        admin_notified: true,
        admin_notified_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateErr) {
      console.error("Update admin_notified error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Email sent but failed to update record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-admin-payment-submitted error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
