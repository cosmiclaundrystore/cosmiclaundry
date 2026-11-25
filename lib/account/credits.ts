// Credit rules shared by the account page and checkout (the database applies the same numbers:
// supabase/migrations/*_customer_credits.sql).
export const CREDITS_PER_TEE = 100;
export const CREDITS_PER_CUSTOM_TEE = 200;
export const CREDITS_FOR_REWARD = 1000;
/** The reward: this share of the tees off, plus free delivery. */
export const REWARD_TEE_DISCOUNT = 0.2;

export function creditsForLine(line: { quantity: number; design?: unknown; collection?: string }): number {
  const custom = !!line.design || line.collection === 'custom';
  return line.quantity * (custom ? CREDITS_PER_CUSTOM_TEE : CREDITS_PER_TEE);
}
