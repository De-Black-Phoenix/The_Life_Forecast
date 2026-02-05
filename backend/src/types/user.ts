import { UserStatus } from "../utils/states";

export type ServiceType = "life_forecast" | "destiny_readings";

export interface User {
  id: string;
  phone: string;
  status: UserStatus;
  selected_plan: string | null;
  service_type?: ServiceType;
  created_at: string;
}
