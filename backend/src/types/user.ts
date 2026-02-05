import { UserStatus } from "../utils/states";

export type ServiceType = "life_forecast" | "destiny_readings";

export interface User {
  id: string;
  phone: string;
  status: UserStatus;
  selected_plan: string | null;
  service_type?: ServiceType;
  created_at: string;
  reading_sent?: boolean;
  reading_sent_at?: string | null;
  reading_send_error?: string | null;
  reading_outcome_text?: string | null;
}
