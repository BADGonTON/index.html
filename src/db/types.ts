export interface UserRow {
  user_id: number;
  username: string | null;
  balance: number;
  referrer_id: number | null;
  ref_earned: number;
  banned_until: number;
  created_at: number;
}

export interface PaymentRow {
  unique_sum: number;
  user_id: number;
  amount: number;
  status: string;
  created_at: number;
  post_link: string | null;
}

export interface PendingTxRow {
  id: number;
  type: string;
  data_json: string;
  status: string;
  retries: number;
  created_at: string;
  error_msg: string | null;
}

export interface OrderRow {
  id: number;
  type: string;
  buyer_id: number;
  buyer_username: string | null;
  recipient_username: string | null;
  quantity: number | null;
  months: number | null;
  ton: number | null;
  uzs: number | null;
  status: string | null;
  created_at: string | null;
}
