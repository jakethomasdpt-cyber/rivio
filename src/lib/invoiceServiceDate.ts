type DatedInvoiceLine = { service_date?: unknown; veda_metadata?: unknown };

function validDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Service dates are calendar dates, not timestamps; never shift them into the browser timezone. */
export function invoiceServiceDate(item: DatedInvoiceLine): string | null {
  if (validDateOnly(item.service_date)) return item.service_date;
  const metadata = item.veda_metadata;
  if (metadata && typeof metadata === 'object' && 'serviceDate' in metadata && validDateOnly(metadata.serviceDate)) {
    return metadata.serviceDate;
  }
  return null;
}

export function invoiceServiceDateLabel(item: DatedInvoiceLine): string | null {
  const date = invoiceServiceDate(item);
  if (!date) return null;
  const [year, month, day] = date.split('-');
  return `Service date: ${month}/${day}/${year}`;
}
