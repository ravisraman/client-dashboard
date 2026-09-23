import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const env = {
  appUrl: () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  calApiKey: () => required("CALCOM_API_KEY"),
  calApiUrl: () => (process.env.CALCOM_API_URL ?? "https://api.cal.com").replace(/\/$/, ""),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  /** Clients can't cancel/reschedule sessions starting sooner than this. 0 disables the rule. */
  changeCutoffHours: () => Number(process.env.CHANGE_CUTOFF_HOURS ?? "24"),
  adminTimeZone: () => process.env.ADMIN_TIME_ZONE ?? "America/Chicago",
  bookingUrl: () => process.env.BOOKING_URL,
  brandName: () => process.env.BRAND_NAME ?? "Ravi Raman",
};
