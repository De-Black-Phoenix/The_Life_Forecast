import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { ConversationStep, UserStatus } from "../utils/states";
import { User } from "../types/user";

/**
 * Hard-require environment variables so we fail fast with a clear error
 * instead of initializing Supabase with empty strings and crashing later.
 */
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || val.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val.trim();
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Conversation {
  id: string;
  user_id: string;
  current_step: ConversationStep;
  collected_data: Record<string, unknown>;
  updated_at: string;
}

export async function getOrCreateUserByPhone(phone: string): Promise<User> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;

  if (data) return data as User;

  const newUser: User = {
    id: uuidv4(),
    phone,
    status: UserStatus.NEW,
    selected_plan: null,
    created_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase.from("users").insert(newUser);

  if (insertError) throw insertError;

  return newUser;
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data as User) || null;
}

export async function getConversationByUserId(
  userId: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data as Conversation) || null;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  screenshot_url: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
  rejection_reason?: string | null;
  rejection_note?: string | null;
  received_amount_ghs?: number | null;
  expected_amount_ghs?: number | null;
}

export async function createConversation(
  userId: string,
  step: ConversationStep
): Promise<Conversation> {
  const conversation: Conversation = {
    id: uuidv4(),
    user_id: userId,
    current_step: step,
    collected_data: {},
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("conversations").insert(conversation);

  if (error) throw error;

  return conversation;
}

export async function updateConversation(
  conversationId: string,
  updates: Partial<Conversation>
): Promise<void> {
  const payload = { ...updates, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from("conversations")
    .update(payload)
    .eq("id", conversationId);

  if (error) throw error;
}

export async function updateUserStatus(
  userId: string,
  status: UserStatus,
  selectedPlan?: string | null
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (selectedPlan !== undefined) {
    updates.selected_plan = selectedPlan;
  }

  const { error } = await supabase.from("users").update(updates).eq("id", userId);

  if (error) throw error;
}

export async function createPayment(
  userId: string,
  screenshotUrl: string
): Promise<void> {
  const now = new Date().toISOString();
  const updatePayload = {
    screenshot_url: screenshotUrl,
    verified: false,
    updated_at: now,
    rejection_reason: null,
    rejection_note: null,
    received_amount_ghs: null,
    expected_amount_ghs: null
  };

  const { data, error } = await supabase
    .from("payments")
    .update(updatePayload)
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    const insertPayload = {
      id: uuidv4(),
      user_id: userId,
      screenshot_url: screenshotUrl,
      verified: false,
      created_at: now,
      updated_at: now,
      rejection_reason: null,
      rejection_note: null,
      received_amount_ghs: null,
      expected_amount_ghs: null
    };
    const { error: insertError } = await supabase
      .from("payments")
      .insert(insertPayload);
    if (insertError) throw insertError;
  }
}

export async function getPaymentById(
  paymentId: string
): Promise<PaymentRecord | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (error) throw error;

  return (data as PaymentRecord) || null;
}

export async function getLatestPaymentByUserId(
  userId: string
): Promise<PaymentRecord | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data as PaymentRecord) || null;
}

export async function verifyLatestPayment(userId: string): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({
      verified: true,
      updated_at: new Date().toISOString(),
      rejection_reason: null,
      rejection_note: null,
      received_amount_ghs: null,
      expected_amount_ghs: null
    })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function rejectPayment(
  userId: string,
  payload: {
    rejection_reason: string;
    rejection_note?: string | null;
    received_amount_ghs?: number | null;
    expected_amount_ghs?: number | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({
      verified: false,
      updated_at: new Date().toISOString(),
      ...payload
    })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function listUsers(status?: string): Promise<User[]> {
  let query = supabase
    .from("users")
    .select("id, phone, status, selected_plan, created_at")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as User[]) || [];
}

export interface PaymentWithUser {
  id: string;
  user_id: string;
  screenshot_url: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
  rejection_reason?: string | null;
  rejection_note?: string | null;
  received_amount_ghs?: number | null;
  expected_amount_ghs?: number | null;
  user: {
    phone: string;
    selected_plan: string | null;
    status: string;
  } | null;
}

export async function listUnverifiedPayments(): Promise<PaymentWithUser[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, user_id, screenshot_url, verified, created_at, updated_at, rejection_reason, rejection_note, received_amount_ghs, expected_amount_ghs, users (phone, selected_plan, status)"
    )
    .eq("verified", false)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (
    data?.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      screenshot_url: row.screenshot_url,
      verified: row.verified,
      created_at: row.created_at,
      updated_at: row.updated_at,
      rejection_reason: row.rejection_reason,
      rejection_note: row.rejection_note,
      received_amount_ghs: row.received_amount_ghs,
      expected_amount_ghs: row.expected_amount_ghs,
      user: Array.isArray(row.users) ? row.users[0] || null : row.users || null
    })) || []
  );
}
