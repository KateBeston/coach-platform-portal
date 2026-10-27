export const EMAIL_KIND: Record<string, string> = {
  booking_confirmed: "Booking confirmed",
  session_moved: "Session moved",
  session_cancelled: "Session cancelled",
  session_reminder: "Reminder",
  coach_nudge: "Not booked yet (to coach)",
  test: "Test",
};

export const usd = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "USD", minimumFractionDigits: Number(n ?? 0) < 1 ? 4 : 2 }).format(Number(n ?? 0));
