'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Send,
  Check,
  Copy,
  Trash2,
  Eye,
  ChevronRight,
  DollarSign,
  X,
  Calendar,
  AlertCircle,
  FileText,
  MoreVertical,
  UserRound,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate, generateInvoiceNumber, cn, getDaysUntilDue } from '@/lib/utils';
import type { Client, Invoice } from '@/types';
import { useWorkspace } from '@/hooks/useWorkspace';

interface DraftLineItem {
  id: string;
  service: string;
  service_date: string;
  provider: string;
  rate: number;
  quantity: number;
}

interface NewInvoiceForm {
  client_id: string;
  client_name: string;
  client_email: string;
  line_items: DraftLineItem[];
  tax_rate: number;
  due_date: string;
  notes: string;
  internal_notes: string;
  reminder_enabled: boolean;
  accept_credit_card: boolean;
  accept_venmo: boolean;
  accept_zelle: boolean;
  accept_ach: boolean;
  accept_wallet: boolean;
}

type FilterTab = 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'viewed';

// Helper to make API requests
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function createEmptyLineItem(id = '1'): DraftLineItem {
  return {
    id,
    service: '',
    service_date: '',
    provider: '',
    rate: 0,
    quantity: 1,
  };
}

function createEmptyInvoiceForm(): NewInvoiceForm {
  return {
    client_id: '',
    client_name: '',
    client_email: '',
    line_items: [createEmptyLineItem()],
    tax_rate: 0,
    due_date: '',
    notes: '',
    internal_notes: '',
    reminder_enabled: true,
    accept_credit_card: true,
    accept_venmo: false,
    accept_zelle: false,
    accept_ach: false,
    accept_wallet: true,
  };
}

export default function InvoicesPage() {
  const { workspace } = useWorkspace();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [newInvoiceForm, setNewInvoiceForm] = useState<NewInvoiceForm>(createEmptyInvoiceForm);
  const [openedFromHomeShortcut, setOpenedFromHomeShortcut] = useState(false);

  // Load invoices and clients from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [invoicesData, clientsData] = await Promise.all([
          apiFetch('/api/invoices'),
          apiFetch('/api/clients'),
        ]);
        setInvoices(invoicesData || []);
        setClients(clientsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const clientOptions = [
    { value: '', label: clients.length > 0 ? 'Enter a client manually' : 'No saved clients yet' },
    ...clients.map((client) => ({
      value: client.id,
      label: client.email ? `${client.name} (${client.email})` : client.name,
    })),
  ];

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setShowNewInvoiceModal(true);
      setOpenedFromHomeShortcut(true);
    }
  }, []);

  const resetForm = () => {
    setNewInvoiceForm(createEmptyInvoiceForm());
  };

  const closeNewInvoiceModal = () => {
    setShowNewInvoiceModal(false);
    resetForm();
    if (openedFromHomeShortcut && typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
      setOpenedFromHomeShortcut(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    if (activeFilter !== 'all') {
      filtered = filtered.filter((invoice) => invoice.status === activeFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoice_number.toLowerCase().includes(query) ||
          (invoice.client_name || '').toLowerCase().includes(query) ||
          (invoice.client_email || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeFilter, invoices, searchQuery]);

  const calculateLineItemAmount = (rate: number, quantity: number) => rate * quantity;

  const newInvoiceSubtotal = useMemo(
    () =>
      newInvoiceForm.line_items.reduce(
        (sum, item) => sum + calculateLineItemAmount(item.rate, item.quantity),
        0
      ),
    [newInvoiceForm.line_items]
  );

  const newInvoiceTaxAmount = (newInvoiceSubtotal * newInvoiceForm.tax_rate) / 100;
  const newInvoiceTotal = newInvoiceSubtotal + newInvoiceTaxAmount;

  const stats = useMemo(() => {
    return {
      draft: invoices.filter((invoice) => invoice.status === 'draft').length,
      sent: invoices.filter((invoice) => invoice.status === 'sent').length,
      paid: invoices.filter((invoice) => invoice.status === 'paid').length,
      overdue: invoices.filter((invoice) => invoice.status === 'overdue').length,
      viewed: invoices.filter((invoice) => invoice.status === 'viewed').length,
      totalAmount: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
      totalOutstanding: invoices
        .filter((invoice) => invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + invoice.total, 0),
    };
  }, [invoices]);

  const updateLineItem = (index: number, field: keyof DraftLineItem, value: string | number) => {
    setNewInvoiceForm((current) => {
      const lineItems = [...current.line_items];
      lineItems[index] = { ...lineItems[index], [field]: value };
      return { ...current, line_items: lineItems };
    });
  };

  const addLineItem = () => {
    setNewInvoiceForm((current) => ({
      ...current,
      line_items: [...current.line_items, createEmptyLineItem(String(current.line_items.length + 1))],
    }));
  };

  const removeLineItem = (index: number) => {
    setNewInvoiceForm((current) => ({
      ...current,
      line_items:
        current.line_items.length > 1
          ? current.line_items.filter((_, currentIndex) => currentIndex !== index)
          : current.line_items,
    }));
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((entry) => entry.id === clientId);
    setNewInvoiceForm((current) => ({
      ...current,
      client_id: clientId,
      client_name: client?.name || current.client_name,
      client_email: client?.email || current.client_email,
    }));
  };

  const buildInvoicePayload = (): any => {
    const trimmedName = newInvoiceForm.client_name.trim();
    const trimmedEmail = newInvoiceForm.client_email.trim();
    const hasValidLineItems = newInvoiceForm.line_items.every((item) => item.service.trim().length > 0);

    if (!trimmedName || !newInvoiceForm.due_date || !hasValidLineItems) {
      return null;
    }

    return {
      client_id: newInvoiceForm.client_id || null,
      client_name: newInvoiceForm.client_name.trim(),
      client_email: newInvoiceForm.client_email.trim(),
      line_items: newInvoiceForm.line_items.map((item) => ({
        service: item.service.trim(),
        service_date: item.service_date,
        provider: item.provider.trim(),
        rate: item.rate,
        quantity: item.quantity,
      })),
      tax_rate: newInvoiceForm.tax_rate,
      due_date: newInvoiceForm.due_date,
      notes: newInvoiceForm.notes.trim() || null,
      internal_notes: newInvoiceForm.internal_notes.trim() || null,
      reminder_enabled: newInvoiceForm.reminder_enabled,
      accept_credit_card: newInvoiceForm.accept_credit_card,
      accept_venmo: newInvoiceForm.accept_venmo,
      accept_zelle: newInvoiceForm.accept_zelle,
      accept_ach: newInvoiceForm.accept_ach,
      accept_wallet: newInvoiceForm.accept_wallet,
    };
  };

  const handleSaveInvoice = async () => {
    const payload = buildInvoicePayload();
    if (!payload) return;

    try {
      await apiFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Refetch invoices
      const invoicesData = await apiFetch('/api/invoices');
      setInvoices(invoicesData || []);

      closeNewInvoiceModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    }
  };

  const handleSaveAndSend = async () => {
    const payload = buildInvoicePayload();
    if (!payload) return;

    // Must have client email to send
    const email = newInvoiceForm.client_email.trim();
    if (!email) {
      setError('A client email address is required to send an invoice.');
      return;
    }

    try {
      // 1. Create the invoice (API auto-creates client if needed)
      const created = await apiFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          client_name: newInvoiceForm.client_name.trim(),
          client_email: email,
        }),
      });

      // 2. Immediately send it
      await apiFetch(`/api/invoices/${created.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // 3. Refresh list
      const invoicesData = await apiFetch('/api/invoices');
      setInvoices(invoicesData || []);

      closeNewInvoiceModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create and send invoice');
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      await apiFetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Refetch invoices
      const invoicesData = await apiFetch('/api/invoices');
      setInvoices(invoicesData || []);

      // Get the invoice to show client email in alert
      const invoice = invoicesData?.find((inv: Invoice) => inv.id === invoiceId);
      const clientEmail = invoice?.clients?.email || invoice?.client_email || 'client';
      alert(`Invoice sent successfully! Email delivered to ${clientEmail}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invoice');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await apiFetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'other' }),
      });

      // Refetch invoices
      const invoicesData = await apiFetch('/api/invoices');
      setInvoices(invoicesData || []);

      alert('Invoice marked as paid');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid');
    }
  };

  const handleDuplicate = async (invoiceId: string) => {
    try {
      await apiFetch(`/api/invoices/${invoiceId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Refetch invoices
      const invoicesData = await apiFetch('/api/invoices');
      setInvoices(invoicesData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate invoice');
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      await apiFetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      // Refetch invoices
      const invoicesData = await apiFetch('/api/invoices');
      setInvoices(invoicesData || []);

      setExpandedInvoiceId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-200">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Invoices</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create invoices fast, with or without a saved client.
          </p>
        </div>
        <Button onClick={() => setShowNewInvoiceModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          {[
            { id: 'all' as FilterTab, label: 'All', count: invoices.length },
            { id: 'draft' as FilterTab, label: 'Draft', count: stats.draft },
            { id: 'sent' as FilterTab, label: 'Sent', count: stats.sent },
            { id: 'viewed' as FilterTab, label: 'Viewed', count: stats.viewed },
            { id: 'paid' as FilterTab, label: 'Paid', count: stats.paid },
            { id: 'overdue' as FilterTab, label: 'Overdue', count: stats.overdue },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                activeFilter === filter.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              )}
            >
              {filter.label} {filter.count > 0 && <span className="ml-1">({filter.count})</span>}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Outstanding"
          value={formatCurrency(stats.totalOutstanding)}
          icon={<DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats.totalAmount)}
          icon={<Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
          accent="bg-green-50 dark:bg-green-900/20"
        />
        <StatCard
          label="Overdue Invoices"
          value={String(stats.overdue)}
          icon={<AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
          accent="bg-red-50 dark:bg-red-900/20"
        />
        <StatCard
          label="Saved Clients"
          value={String(clients.length)}
          icon={<UserRound className="h-5 w-5 text-slate-600 dark:text-slate-300" />}
          accent="bg-slate-100 dark:bg-slate-700"
        />
      </div>

      <Card padding={false}>
        {filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <FileText className="mb-4 h-12 w-12 text-slate-400 dark:text-slate-500" />
            <h3 className="mb-2 text-lg font-medium text-slate-900 dark:text-white">No invoices yet</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {searchQuery ? 'Try adjusting your search terms.' : 'Create your first invoice and send it when you are ready.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowNewInvoiceModal(true)} className="mt-4">
                Create Invoice
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="border-b border-slate-200 last:border-b-0 dark:border-slate-700">
                <div
                  className="flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  onClick={() =>
                    setExpandedInvoiceId(expandedInvoiceId === invoice.id ? null : invoice.id)
                  }
                >
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedInvoiceId(expandedInvoiceId === invoice.id ? null : invoice.id);
                    }}
                    className="flex-shrink-0"
                  >
                    <ChevronRight
                      className={cn(
                        'h-5 w-5 text-slate-400 transition-transform duration-200',
                        expandedInvoiceId === invoice.id && 'rotate-90'
                      )}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{invoice.invoice_number}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {invoice.clients?.name ?? invoice.client_name ?? 'Unknown'}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                        <div className="text-sm">
                          <p className="text-slate-600 dark:text-slate-400">Created</p>
                          <p className="font-medium text-slate-900 dark:text-white">{formatDate(invoice.created_at)}</p>
                        </div>
                        <div className="text-sm">
                          <p className="text-slate-600 dark:text-slate-400">Due Date</p>
                          <p
                            className={cn(
                              'font-medium',
                              getDaysUntilDue(invoice.due_date) < 0 && invoice.status !== 'paid'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-900 dark:text-white'
                            )}
                          >
                            {formatDate(invoice.due_date)}
                          </p>
                        </div>
                        <div className="text-sm">
                          <p className="text-slate-600 dark:text-slate-400">Amount</p>
                          <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(invoice.total)}</p>
                        </div>
                        <div className="text-sm">
                          <p className="mb-1 text-slate-600 dark:text-slate-400">Status</p>
                          <StatusBadge status={invoice.status} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <InvoiceQuickActions
                    invoice={invoice}
                    onSend={() => handleSendInvoice(invoice.id)}
                    onMarkPaid={() => handleMarkPaid(invoice.id)}
                    onDuplicate={() => handleDuplicate(invoice.id)}
                    onDelete={() => handleDelete(invoice.id)}
                  />
                </div>

                {expandedInvoiceId === invoice.id && (
                  <InvoiceDetailView
                    invoice={invoice}
                    onSend={() => handleSendInvoice(invoice.id)}
                    onMarkPaid={() => handleMarkPaid(invoice.id)}
                    onDuplicate={() => handleDuplicate(invoice.id)}
                    onDelete={() => handleDelete(invoice.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={showNewInvoiceModal} onClose={closeNewInvoiceModal} title="Create New Invoice" size="xl">
        <NewInvoiceFormPanel
          clients={clients}
          clientOptions={clientOptions}
          form={newInvoiceForm}
          setForm={setNewInvoiceForm}
          onClientSelect={handleClientSelect}
          onAddLineItem={addLineItem}
          onRemoveLineItem={removeLineItem}
          onUpdateLineItem={updateLineItem}
          subtotal={newInvoiceSubtotal}
          taxAmount={newInvoiceTaxAmount}
          total={newInvoiceTotal}
          calculateLineItemAmount={calculateLineItemAmount}
          onSave={handleSaveInvoice}
          onSend={handleSaveAndSend}
          onCancel={closeNewInvoiceModal}
          workspaceVenmo={workspace?.venmo_handle || ''}
          workspaceZelle={workspace?.zelle_phone || ''}
          workspaceStripe={true}
        />
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={cn('rounded-lg p-2.5', accent)}>{icon}</div>
      </div>
    </Card>
  );
}

interface InvoiceQuickActionsProps {
  invoice: Invoice;
  onSend: () => void;
  onMarkPaid: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function InvoiceQuickActions({
  invoice,
  onSend,
  onMarkPaid,
  onDuplicate,
  onDelete,
}: InvoiceQuickActionsProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative flex flex-shrink-0 items-center gap-2">
      {invoice.status === 'draft' && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onSend();
          }}
          className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          title="Send invoice"
        >
          <Send className="h-4 w-4" />
        </button>
      )}

      {invoice.status !== 'paid' && invoice.status !== 'draft' && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onMarkPaid();
          }}
          className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
          title="Mark as paid"
        >
          <Check className="h-4 w-4" />
        </button>
      )}

      <div className="relative">
        <button
          onClick={(event) => {
            event.stopPropagation();
            setShowMenu((current) => !current);
          }}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {showMenu && (
          <div className="absolute right-0 z-10 mt-2 w-40 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceDetailView({
  invoice,
  onSend,
  onMarkPaid,
  onDuplicate,
  onDelete,
}: {
  invoice: Invoice;
  onSend: () => void;
  onMarkPaid: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const daysUntilDue = getDaysUntilDue(invoice.due_date);
  const isOverdue = daysUntilDue < 0 && invoice.status !== 'paid';

  return (
    <div className="space-y-4 bg-slate-50 px-6 py-4 dark:bg-slate-700/20">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Invoice Timeline</h3>
        <div className="space-y-2">
          {[
            { event: 'Created', date: invoice.created_at, icon: FileText },
            { event: 'Sent', date: invoice.sent_at, icon: Send, enabled: !!invoice.sent_at },
            { event: 'Viewed', date: invoice.viewed_at, icon: Eye, enabled: !!invoice.viewed_at },
            { event: 'Paid', date: invoice.paid_date, icon: Check, enabled: invoice.status === 'paid' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className={cn(
                  'rounded-full p-2',
                  item.enabled ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-100 dark:bg-slate-700'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4',
                    item.enabled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.event}</p>
                {item.date && <p className="text-xs text-slate-600 dark:text-slate-400">{formatDate(item.date)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isOverdue && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200">Overdue</p>
            <p className="text-xs text-red-700 dark:text-red-300">Due date was {Math.abs(daysUntilDue)} days ago</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Line Items</h3>
        <div className="space-y-2 text-sm">
          {invoice.line_items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-slate-900 dark:text-white">{item.service}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {item.provider || 'No provider set'}
                  {item.service_date ? ` • ${formatDate(item.service_date)}` : ''}
                </p>
              </div>
              <p className="font-medium text-slate-900 dark:text-white">
                {item.quantity} × {formatCurrency(item.rate)} = {formatCurrency(item.amount)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-600">
        <div className="flex justify-between">
          <p className="text-slate-600 dark:text-slate-400">Subtotal</p>
          <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(invoice.subtotal)}</p>
        </div>
        {invoice.tax_amount > 0 && (
          <div className="flex justify-between">
            <p className="text-slate-600 dark:text-slate-400">Tax ({invoice.tax_rate}%)</p>
            <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(invoice.tax_amount)}</p>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
          <p className="font-semibold text-slate-900 dark:text-white">Total</p>
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(invoice.total)}</p>
        </div>
      </div>

      {invoice.notes && (
        <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-slate-600">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Notes</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{invoice.notes}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-600">
        {invoice.status === 'draft' && (
          <Button onClick={onSend} size="sm" className="gap-2">
            <Send className="h-4 w-4" />
            Send Invoice
          </Button>
        )}
        {invoice.status !== 'paid' && invoice.status !== 'draft' && (
          <Button onClick={onMarkPaid} size="sm" variant="secondary" className="gap-2">
            <Check className="h-4 w-4" />
            Mark Paid
          </Button>
        )}
        <Button onClick={onDuplicate} size="sm" variant="outline" className="gap-2">
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
        <Button onClick={onDelete} size="sm" variant="danger" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function NewInvoiceFormPanel({
  clients,
  clientOptions,
  form,
  setForm,
  onClientSelect,
  onAddLineItem,
  onRemoveLineItem,
  onUpdateLineItem,
  subtotal,
  taxAmount,
  total,
  calculateLineItemAmount,
  onSave,
  onSend,
  onCancel,
  workspaceVenmo,
  workspaceZelle,
  workspaceStripe,
}: {
  clients: Client[];
  clientOptions: { value: string; label: string }[];
  form: NewInvoiceForm;
  setForm: Dispatch<SetStateAction<NewInvoiceForm>>;
  onClientSelect: (clientId: string) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
  onUpdateLineItem: (index: number, field: keyof DraftLineItem, value: string | number) => void;
  subtotal: number;
  taxAmount: number;
  total: number;
  calculateLineItemAmount: (rate: number, quantity: number) => number;
  onSave: () => void;
  onSend: () => void;
  onCancel: () => void;
  workspaceVenmo: string;
  workspaceZelle: string;
  workspaceStripe: boolean;
}) {
  const missingRequiredFields =
    !form.client_name.trim() ||
    !form.due_date ||
    form.line_items.some((item) => !item.service.trim());
  const missingEmailForSend = !form.client_email.trim();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Start with the invoice, not the client</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Pick a saved client if you have one, or type the recipient details directly. When you send an invoice with an email address, we will save that client for next time.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="Saved Client (Optional)"
          options={clientOptions}
          value={form.client_id}
          onChange={(event) => onClientSelect(event.target.value)}
        />
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {clients.length > 0
            ? `${clients.length} saved client${clients.length === 1 ? '' : 's'} available for autofill.`
            : 'No saved clients yet. The first invoice you send with an email address will create one automatically.'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Client Name"
          placeholder="Jane Doe"
          value={form.client_name}
          onChange={(event) => setForm((current) => ({ ...current, client_name: event.target.value }))}
        />
        <Input
          label="Client Email"
          type="email"
          placeholder="jane@example.com"
          value={form.client_email}
          onChange={(event) => setForm((current) => ({ ...current, client_email: event.target.value }))}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Service Line Items</h3>
          <Button onClick={onAddLineItem} size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {form.line_items.map((item, index) => (
            <div key={item.id} className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-700/20">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Service"
                  placeholder="Physical therapy session"
                  value={item.service}
                  onChange={(event) => onUpdateLineItem(index, 'service', event.target.value)}
                />
                <Input
                  label="Service Date"
                  type="date"
                  value={item.service_date}
                  onChange={(event) => onUpdateLineItem(index, 'service_date', event.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Input
                  label="Provider"
                  placeholder="Jake Thomas, DPT"
                  value={item.provider}
                  onChange={(event) => onUpdateLineItem(index, 'provider', event.target.value)}
                />
                <Input
                  label="Rate ($)"
                  type="number"
                  step="0.01"
                  value={item.rate}
                  onChange={(event) => onUpdateLineItem(index, 'rate', parseFloat(event.target.value) || 0)}
                />
                <Input
                  label="Qty"
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => onUpdateLineItem(index, 'quantity', parseInt(event.target.value, 10) || 1)}
                />
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Amount</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(calculateLineItemAmount(item.rate, item.quantity))}
                    </p>
                  </div>
                  {form.line_items.length > 1 && (
                    <Button onClick={() => onRemoveLineItem(index)} variant="danger" size="sm">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Optional invoice details</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Add tax or review totals only if you need them.
            </p>
          </div>
          <ChevronRight
            className={cn(
              'h-5 w-5 text-slate-400 transition-transform duration-200',
              showAdvanced && 'rotate-90'
            )}
          />
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/20">
            <Input
              label="Tax Rate (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.tax_rate}
              onChange={(event) =>
                setForm((current) => ({ ...current, tax_rate: parseFloat(event.target.value) || 0 }))
              }
              className="md:w-36"
            />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Tax</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-600">
                <span className="font-semibold text-slate-900 dark:text-white">Total</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Invoice Due Date"
          type="date"
          value={form.due_date}
          onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
        />
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
          <input
            type="checkbox"
            id="reminder_enabled"
            checked={form.reminder_enabled}
            onChange={(event) =>
              setForm((current) => ({ ...current, reminder_enabled: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="reminder_enabled" className="text-sm text-slate-700 dark:text-slate-300">
            Enable payment reminders
          </label>
        </div>
      </div>

      <Textarea
        label="Client Notes"
        placeholder="Visible on the invoice"
        value={form.notes}
        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
      />

      <Textarea
        label="Internal Notes"
        placeholder="Private notes for your reference"
        value={form.internal_notes}
        onChange={(event) => setForm((current) => ({ ...current, internal_notes: event.target.value }))}
      />

      {/* Payment Options */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Payment options for this invoice</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Choose how your client can pay. These appear on the invoice portal.
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {/* Credit / Debit Card */}
          <label className={cn(
            'flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30',
            !workspaceStripe && 'opacity-50 cursor-not-allowed'
          )}>
            <input
              type="checkbox"
              checked={form.accept_credit_card}
              disabled={!workspaceStripe}
              onChange={(e) => setForm((c) => ({ ...c, accept_credit_card: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Credit / Debit Card</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {workspaceStripe ? 'Powered by Stripe' : 'Connect Stripe in Settings to enable'}
                </p>
              </div>
            </div>
            {form.accept_credit_card && workspaceStripe && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">On</span>
            )}
          </label>

          {/* Venmo */}
          <label className={cn(
            'flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30',
            !workspaceVenmo && 'opacity-50 cursor-not-allowed'
          )}>
            <input
              type="checkbox"
              checked={form.accept_venmo}
              disabled={!workspaceVenmo}
              onChange={(e) => setForm((c) => ({ ...c, accept_venmo: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">V</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Venmo</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {workspaceVenmo ? `@${workspaceVenmo}` : 'Add your Venmo handle in Settings to enable'}
                </p>
              </div>
            </div>
            {form.accept_venmo && workspaceVenmo && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">On</span>
            )}
          </label>

          {/* Zelle */}
          <label className={cn(
            'flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30',
            !workspaceZelle && 'opacity-50 cursor-not-allowed'
          )}>
            <input
              type="checkbox"
              checked={form.accept_zelle}
              disabled={!workspaceZelle}
              onChange={(e) => setForm((c) => ({ ...c, accept_zelle: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">Z</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Zelle</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {workspaceZelle ? workspaceZelle : 'Add your Zelle phone in Settings to enable'}
                </p>
              </div>
            </div>
            {form.accept_zelle && workspaceZelle && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">On</span>
            )}
          </label>

          {/* ACH / Bank Transfer */}
          <label className={cn(
            'flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30',
            !workspaceStripe && 'opacity-50 cursor-not-allowed'
          )}>
            <input
              type="checkbox"
              checked={form.accept_ach}
              disabled={!workspaceStripe}
              onChange={(e) => setForm((c) => ({ ...c, accept_ach: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">ACH / Bank Transfer</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {workspaceStripe
                    ? 'Client pays from their bank account — 0.8% fee, capped at $5'
                    : 'Connect Stripe in Settings to enable'}
                </p>
              </div>
            </div>
            {form.accept_ach && workspaceStripe && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">On</span>
            )}
          </label>

          {/* Apple Pay / Google Pay */}
          <label className={cn(
            'flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30',
            !workspaceStripe && 'opacity-50 cursor-not-allowed'
          )}>
            <input
              type="checkbox"
              checked={form.accept_wallet}
              disabled={!workspaceStripe}
              onChange={(e) => setForm((c) => ({ ...c, accept_wallet: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
                <svg className="h-4 w-4 text-white dark:text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Apple Pay / Google Pay</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {workspaceStripe
                    ? 'One-tap wallet payments via Stripe — same card fees apply'
                    : 'Connect Stripe in Settings to enable'}
                </p>
              </div>
            </div>
            {form.accept_wallet && workspaceStripe && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">On</span>
            )}
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 border-t border-slate-200 pt-6 dark:border-slate-700">
        {/* Primary: Save & Send */}
        <Button
          onClick={onSend}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={missingRequiredFields || missingEmailForSend}
        >
          <Send className="mr-2 h-4 w-4" />
          {missingEmailForSend ? 'Add client email to send' : 'Save & Send Invoice'}
        </Button>

        {/* Secondary row */}
        <div className="flex gap-3">
          <Button
            onClick={onSave}
            variant="outline"
            className="flex-1"
            disabled={missingRequiredFields}
          >
            Save as Draft
          </Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
