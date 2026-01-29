export type UserStatus =
  | "NEW"
  | "AWAITING_PAYMENT"
  | "PAYMENT_SUBMITTED"
  | "VERIFIED"
  | "COMPLETED";

export interface User {
  id: string;
  phone: string;
  status: UserStatus;
  selected_plan: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  screenshot_url: string;
  verified: boolean;
  created_at: string;
  updated_at?: string;
  user?: {
    phone: string;
    selected_plan: string | null;
    status: UserStatus;
  } | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  current_step: string;
  collected_data: Record<string, unknown>;
  updated_at: string;
}

export interface UserProfileResponse {
  user: User;
  conversation: Conversation | null;
  latestPayment: Payment | null;
}
