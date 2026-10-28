import type { PayPeriod } from "./constants";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return naira.format(amount);
}

export function formatPay(payMin: number, payMax: number, period: PayPeriod): string {
  const range = payMin === payMax ? formatNaira(payMin) : `${formatNaira(payMin)} – ${formatNaira(payMax)}`;
  return `${range} / ${period}`;
}

/** "+2348031234567" → "+234 803 123 4567". Other values are returned unchanged. */
export function formatPhone(phone: string): string {
  const match = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+234 ${match[1]} ${match[2]} ${match[3]}` : phone;
}
