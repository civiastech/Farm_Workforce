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
