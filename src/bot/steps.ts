/**
 * Barcha FSM bosqich nomlari. Yangi ko'p bosqichli funksiya qo'shsangiz:
 *   1. shu yerga nom qo'shing
 *   2. handler faylida `handleXText(ctx)` yozing
 *   3. handlers/textRouter.ts switch-case'iga bitta qator qo'shing
 */
export const STEP = {
  PAY_AMOUNT: "pay:amount",

  STARS_QTY: "stars:qty",
  STARS_USERNAME: "stars:username",

  PREMIUM_USERNAME: "premium:username",
  PREMIUM_MONTHS: "premium:months",

  ADMIN_ADD_BALANCE: "admin:add_balance",
  ADMIN_SUB_BALANCE: "admin:sub_balance",
  ADMIN_BAN_USER: "admin:ban_user",
  ADMIN_SET_PRICE: "admin:set_price",
  ADMIN_SET_TON_RATE: "admin:set_ton_rate",
  ADMIN_SET_SERVICE_FEE: "admin:set_service_fee",
  ADMIN_SET_EXTEND_MIN_DAYS: "admin:set_extend_min_days",
  ADMIN_SET_EXTEND_FEE: "admin:set_extend_fee",
  ADMIN_BROADCAST_WAIT: "admin:broadcast_wait",
  ADMIN_BROADCAST_CONFIRM: "admin:broadcast_confirm",

  ADMIN_GIFT_ADD_ID: "admin:gift_add_id",
  ADMIN_GIFT_ADD_STARS: "admin:gift_add_stars",
  ADMIN_GIFT_ADD_PREMIUM_ID: "admin:gift_add_premium_id",

  ADMIN_TG_ADD_PHONE: "admin:tg_add_phone",
  ADMIN_TG_ADD_PRICE: "admin:tg_add_price",
  ADMIN_TG_ADD_TWOFA: "admin:tg_add_twofa",
  ADMIN_TG_ADD_CODE: "admin:tg_add_code",
} as const;
