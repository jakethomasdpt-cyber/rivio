// USD Checkout amounts are limited to eight digits in the smallest currency unit.
export const MAX_CHECKOUT_CENTS = 99_999_999;

export function parseAdditionalPayment(input: string): number | null {
  const value = input.trim();
  if (!value) return 0;
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)) return null;
  const [dollars, fraction = ''] = value.split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return cents <= MAX_CHECKOUT_CENTS ? cents : null;
}

export function invoiceSurchargeCents(balance: number, rate: number) {
  return Math.round(Math.round(balance * 100) * rate / 100);
}
