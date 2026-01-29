import { UserStatus } from "../utils/states";

export interface User {
  id: string;
  phone: string;
  status: UserStatus;
  selected_plan: string | null;
  created_at: string;
}
