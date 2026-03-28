import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types';

const statusConfig: Record<InvoiceStatus, { label: string; className: string; dotColor: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', dotColor: 'bg-slate-400' },
  sent: { label: 'Sent', className: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', dotColor: 'bg-blue-500' },
  viewed: { label: 'Viewed', className: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400', dotColor: 'bg-purple-500' },
  paid: { label: 'Paid', className: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400', dotColor: 'bg-green-500' },
  overdue: { label: 'Overdue', className: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', dotColor: 'bg-red-500' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', dotColor: 'bg-slate-400' },
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  );
}
