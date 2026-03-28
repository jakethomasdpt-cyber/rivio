'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Users,
  Plus,
  FileText,
  Upload,
  ArrowRight,
  Clock,
  CheckCircle2,
  Send,
  Eye,
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: 'sent' | 'viewed' | 'paid' | 'overdue' | 'draft';
  due_date: string;
  paid_date?: string;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    email: string;
  };
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface DashboardData {
  invoices: Invoice[];
  clients: Client[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{subtext}</p>}
        </div>
        <div className={`${accent} rounded-lg p-3`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { workspace, user } = useWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [invoicesRes, clientsRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/clients'),
        ]);

        if (!invoicesRes.ok || !clientsRes.ok) {
          throw new Error('Failed to fetch data from API');
        }

        const invoices: Invoice[] = await invoicesRes.json();
        const clients: Client[] = await clientsRes.json();

        setData({ invoices, clients });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome back, {workspace?.owner_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="text-slate-600 dark:text-slate-400">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome back, {workspace?.owner_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Card className="border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-300">Error Loading Dashboard</p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error || 'Unable to load data'}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Calculate stats from real data
  const outstandingInvoices = data.invoices.filter(
    (invoice) => invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue'
  );
  const overdueInvoices = data.invoices.filter((invoice) => invoice.status === 'overdue');
  const paidThisMonth = data.invoices
    .filter((invoice) => invoice.status === 'paid' && invoice.paid_date)
    .filter((invoice) => {
      const paidDate = new Date(invoice.paid_date!);
      return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
    })
    .reduce((sum, invoice) => sum + invoice.total, 0);

  const recentInvoices = [...data.invoices]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const activity = recentInvoices
    .map((invoice) => {
      // For now, show recent invoices in activity feed
      return {
        id: `${invoice.id}-updated`,
        type: 'updated',
        date: invoice.updated_at,
        description: `Invoice ${invoice.invoice_number} to ${invoice.clients?.name || 'Client'} - ${formatCurrency(invoice.total)}`,
        icon: <FileText className="h-5 w-5 text-slate-400" />,
      };
    })
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome back, {workspace?.owner_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {today.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={DollarSign}
            label="Total Outstanding"
            value={formatCurrency(outstandingInvoices.reduce((sum, invoice) => sum + invoice.total, 0))}
            subtext={`${outstandingInvoices.length} open invoice${outstandingInvoices.length === 1 ? '' : 's'}`}
            accent="bg-blue-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Paid This Month"
            value={formatCurrency(paidThisMonth)}
            subtext="Collected this month"
            accent="bg-green-600"
          />
          <StatCard
            icon={AlertCircle}
            label="Overdue"
            value={formatCurrency(overdueInvoices.reduce((sum, invoice) => sum + invoice.total, 0))}
            subtext={`${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'} overdue`}
            accent="bg-red-600"
          />
          <StatCard
            icon={Users}
            label="Clients"
            value={String(data.clients.length)}
            subtext="Active client records"
            accent="bg-slate-800"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
          <Card className="flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent Invoices</h2>
              <Link href="/dashboard/invoices">
                <Button variant="ghost" size="sm" className="gap-2">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="flex-grow overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-0 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Invoice</th>
                    <th className="px-0 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Client</th>
                    <th className="px-0 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Amount</th>
                    <th className="px-0 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
                    <th className="px-0 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-0 py-4 font-medium text-slate-900 dark:text-white">{invoice.invoice_number}</td>
                      <td className="px-0 py-4 text-slate-700 dark:text-slate-300">{invoice.clients?.name || 'Unknown Client'}</td>
                      <td className="px-0 py-4 font-medium text-slate-900 dark:text-white">{formatCurrency(invoice.total)}</td>
                      <td className="px-0 py-4"><StatusBadge status={invoice.status} /></td>
                      <td className="px-0 py-4 text-slate-700 dark:text-slate-300">{formatDate(invoice.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
              <div className="flex flex-col gap-3">
                <Link href="/dashboard/invoices?new=1">
                  <Button variant="primary" size="lg" className="w-full justify-start gap-3">
                    <Plus className="h-5 w-5" />
                    New Invoice
                  </Button>
                </Link>
                <Link href="/dashboard/clients?new=1">
                  <Button variant="outline" size="lg" className="w-full justify-start gap-3">
                    <Users className="h-5 w-5" />
                    Add Client
                  </Button>
                </Link>
                <Link href="/dashboard/finance">
                  <Button variant="outline" size="lg" className="w-full justify-start gap-3">
                    <Upload className="h-5 w-5" />
                    Review Finance
                  </Button>
                </Link>
              </div>
            </Card>

            {overdueInvoices.length > 0 && (
              <Card className="border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 dark:text-red-300">
                      {overdueInvoices.length} Invoice{overdueInvoices.length === 1 ? '' : 's'} Overdue
                    </p>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      {formatCurrency(overdueInvoices.reduce((sum, invoice) => sum + invoice.total, 0))} needs attention
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
              </div>
              <div className="space-y-4">
                {activity.map((event, index) => (
                  <div key={event?.id} className="relative flex gap-3">
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      {event?.icon}
                    </div>
                    {index !== activity.length - 1 && (
                      <div className="absolute left-5 top-10 h-8 w-px bg-slate-200 dark:bg-slate-700" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{event?.description}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event?.date ? formatDate(String(event.date)) : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
