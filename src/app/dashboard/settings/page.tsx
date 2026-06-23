'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useWorkspace } from '@/hooks/useWorkspace';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import {
  Save,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Monitor,
  LogOut,
  Check,
  AlertCircle,
  CreditCard,
  Percent,
  Plug,
  KeyRound,
  Webhook,
  Pause,
  Play,
  Trash2,
  Copy,
  RefreshCw,
} from 'lucide-react';

interface FormData {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  stripeApiKey: string;
  stripeConnectStatus: 'connected' | 'disconnected';
  venmoHandle: string;
  zellePhone: string;
  defaultPaymentTerms: string;
  defaultTaxRate: string;
  invoiceNumberPrefix: string;
  defaultNotes: string;
  paymentReminderEnabled: boolean;
  reminderDaysBefore: string;
  reminderDaysAfter: string;
  brandColor?: string;
  surchargeEnabled: boolean;
  cardSurchargeRate: string;
  surchargeLabel: string;
}

interface VedaConnection {
  veda_organization_id: string;
  display_name: string;
  webhook_base_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface VedaIntegrationState {
  isAllowedWorkspace: boolean;
  workspace: { id: string; business_name: string } | null;
  connections: VedaConnection[];
  failedWebhookDeliveries: Array<{
    id: string;
    event_id: string;
    invoice_id: string | null;
    destination_url: string;
    status: string;
    attempt_count: number;
    response_status: number | null;
    last_error: string | null;
    next_retry_at: string | null;
    updated_at: string;
  }>;
  config: {
    allowedRivioOrganizationName: string;
    endpoints: Record<string, string>;
    secrets: {
      vedaToRivioSharedSecretConfigured: boolean;
      rivioToVedaWebhookSecretConfigured: boolean;
      vedaToRivioSharedSecret: string;
      rivioToVedaWebhookSecret: string;
    };
    webhookBaseUrl: string;
  };
}

interface VedaConnectionForm {
  vedaOrganizationId: string;
  displayName: string;
  webhookBaseUrl: string;
  notes: string;
}

const initialFormData: FormData = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  stripeApiKey: '',
  stripeConnectStatus: 'disconnected',
  venmoHandle: '',
  zellePhone: '',
  defaultPaymentTerms: 'net30',
  defaultTaxRate: '0',
  invoiceNumberPrefix: 'INV',
  defaultNotes: '',
  paymentReminderEnabled: false,
  reminderDaysBefore: '3',
  reminderDaysAfter: '3',
  brandColor: '#004a99',
  surchargeEnabled: true,
  cardSurchargeRate: '3.0',
  surchargeLabel: 'Processing fee',
};

export default function SettingsPage() {
  const { theme, setTheme, mounted } = useTheme();
  const { workspace } = useWorkspace();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showStripeKey, setShowStripeKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [vedaState, setVedaState] = useState<VedaIntegrationState | null>(null);
  const [vedaForm, setVedaForm] = useState<VedaConnectionForm>({
    vedaOrganizationId: '',
    displayName: 'Veda EMR',
    webhookBaseUrl: '',
    notes: '',
  });
  const [vedaLoading, setVedaLoading] = useState(true);
  const [vedaSaving, setVedaSaving] = useState(false);
  const [vedaMessage, setVedaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Populate form with workspace data when it loads
  useEffect(() => {
    if (workspace) {
      setFormData(prev => ({
        ...prev,
        businessName: workspace.business_name || '',
        ownerName: workspace.owner_name || '',
        email: workspace.email || '',
        phone: workspace.phone || '',
        address: workspace.address || '',
        city: workspace.city || '',
        state: workspace.state || '',
        zipCode: workspace.zip || '',
        venmoHandle: workspace.venmo_handle || '',
        zellePhone: workspace.zelle_phone || '',
        invoiceNumberPrefix: workspace.invoice_prefix || 'INV',
        defaultTaxRate: workspace.tax_rate_default ? String(workspace.tax_rate_default) : '0',
        surchargeEnabled: workspace.surcharge_enabled !== false,
        cardSurchargeRate: workspace.card_surcharge_rate != null ? String(workspace.card_surcharge_rate) : '3.0',
        surchargeLabel: workspace.surcharge_label || 'Processing fee',
      }));
    }
  }, [workspace]);

  const loadVedaIntegration = async () => {
    try {
      setVedaLoading(true);
      const response = await fetch('/api/settings/integrations/veda');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load Veda integration');
      setVedaState(data);
      const connection = data.connections?.[0];
      if (connection) {
        setVedaForm({
          vedaOrganizationId: connection.veda_organization_id,
          displayName: connection.display_name || 'Veda EMR',
          webhookBaseUrl: connection.webhook_base_url || data.config?.webhookBaseUrl || '',
          notes: connection.notes || '',
        });
      } else {
        setVedaForm((current) => ({
          ...current,
          webhookBaseUrl: data.config?.webhookBaseUrl || current.webhookBaseUrl,
        }));
      }
    } catch (error) {
      setVedaMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load Veda integration',
      });
    } finally {
      setVedaLoading(false);
    }
  };

  useEffect(() => {
    loadVedaIntegration();
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: formData.businessName,
          owner_name: formData.ownerName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zipCode,
          venmo_handle: formData.venmoHandle,
          zelle_phone: formData.zellePhone,
          invoice_prefix: formData.invoiceNumberPrefix,
          tax_rate_default: parseFloat(formData.defaultTaxRate) || 0,
          brand_color: formData.brandColor,
          card_surcharge_rate: parseFloat(formData.cardSurchargeRate) || 0,
          surcharge_enabled: formData.surchargeEnabled,
          surcharge_label: formData.surchargeLabel || 'Processing fee',
        }),
      });

      if (!response.ok) throw new Error('Failed to save workspace');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving workspace:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const showVedaMessage = (type: 'success' | 'error', text: string) => {
    setVedaMessage({ type, text });
    setTimeout(() => setVedaMessage(null), 4000);
  };

  const handleVedaFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setVedaForm((current) => ({ ...current, [name]: value }));
  };

  const saveVedaConnection = async () => {
    try {
      setVedaSaving(true);
      const hasConnection = Boolean(vedaState?.connections?.[0]);
      const response = await fetch('/api/settings/integrations/veda', {
        method: hasConnection ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vedaOrganizationId: vedaForm.vedaOrganizationId,
          displayName: vedaForm.displayName,
          webhookBaseUrl: vedaForm.webhookBaseUrl,
          notes: vedaForm.notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save Veda connection');
      setVedaState(data);
      showVedaMessage('success', hasConnection ? 'Veda connection updated.' : 'Veda connection created.');
    } catch (error) {
      showVedaMessage('error', error instanceof Error ? error.message : 'Failed to save Veda connection');
    } finally {
      setVedaSaving(false);
    }
  };

  const toggleVedaConnection = async (connection: VedaConnection) => {
    try {
      setVedaSaving(true);
      const response = await fetch('/api/settings/integrations/veda', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vedaOrganizationId: connection.veda_organization_id,
          isActive: !connection.is_active,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update Veda connection');
      setVedaState(data);
      showVedaMessage('success', connection.is_active ? 'Veda connection paused.' : 'Veda connection resumed.');
    } catch (error) {
      showVedaMessage('error', error instanceof Error ? error.message : 'Failed to update Veda connection');
    } finally {
      setVedaSaving(false);
    }
  };

  const deleteVedaConnection = async (connection: VedaConnection) => {
    const confirmed = window.confirm(`Delete the Veda connection for ${connection.display_name}?`);
    if (!confirmed) return;

    try {
      setVedaSaving(true);
      const response = await fetch(
        `/api/settings/integrations/veda?vedaOrganizationId=${encodeURIComponent(connection.veda_organization_id)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete Veda connection');
      setVedaState(data);
      setVedaForm({
        vedaOrganizationId: '',
        displayName: 'Veda EMR',
        webhookBaseUrl: data.config?.webhookBaseUrl || '',
        notes: '',
      });
      showVedaMessage('success', 'Veda connection deleted.');
    } catch (error) {
      showVedaMessage('error', error instanceof Error ? error.message : 'Failed to delete Veda connection');
    } finally {
      setVedaSaving(false);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showVedaMessage('success', 'Copied.');
  };

  const brandColorPresets = [
    { name: 'Blue (Primary)', value: '#2563EB', class: 'bg-blue-600' },
    { name: 'Black (Secondary)', value: '#0F172A', class: 'bg-slate-900' },
    { name: 'White (Light)', value: '#FFFFFF', class: 'bg-white border border-slate-300' },
    { name: 'Slate', value: '#1E293B', class: 'bg-slate-800' },
  ];

  const paymentTermsOptions = [
    { value: 'due', label: 'Due Upon Receipt' },
    { value: 'net7', label: 'Net 7' },
    { value: 'net15', label: 'Net 15' },
    { value: 'net30', label: 'Net 30' },
    { value: 'net45', label: 'Net 45' },
    { value: 'net60', label: 'Net 60' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage your business and payment information
            </p>
          </div>
          <Button
            onClick={handleSaveChanges}
            loading={isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Save Status Messages */}
      {saveStatus === 'success' && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-lg">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Settings saved successfully!
            </p>
          </div>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Error saving settings. Please try again.
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Business Information */}
        <Card>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Business Information
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Update your business details
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Business Name"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                placeholder="Your business name"
              />
              <Input
                label="Owner Name"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleInputChange}
                placeholder="Owner name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
              />
              <Input
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(555) 123-4567"
              />
            </div>

            <Input
              label="Street Address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="123 Main St"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="City"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="City"
              />
              <Input
                label="State"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="CA"
              />
              <Input
                label="ZIP Code"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                placeholder="12345"
              />
            </div>

            {/* Logo Upload Area */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Upload Business Logo
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  PNG, JPG up to 2MB
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-4">
                Choose File
              </Button>
            </div>
          </div>
        </Card>

        {/* Workspace Branding */}
        <Card>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Workspace Branding
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Customize your workspace appearance and settings
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Business Name"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                placeholder="Your business name"
              />
              <Input
                label="Owner Name"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleInputChange}
                placeholder="Owner name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Business Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
              />
              <Input
                label="Business Phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Invoice Number Prefix"
                name="invoiceNumberPrefix"
                value={formData.invoiceNumberPrefix}
                onChange={handleInputChange}
                placeholder="INV"
                maxLength={5}
              />
              <Input
                label="Brand Color"
                name="brandColor"
                type="color"
                value={workspace?.brand_color || '#004a99'}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </Card>

        {/* Payment Settings */}
        <Card>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Payment Settings
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Configure payment methods and options
            </p>
          </div>

          <div className="space-y-8">
            {/* Stripe Section */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Stripe
              </h3>
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="API Secret Key"
                      name="stripeApiKey"
                      type={showStripeKey ? 'text' : 'password'}
                      value={formData.stripeApiKey}
                      onChange={handleInputChange}
                      readOnly
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowStripeKey(!showStripeKey)}
                    className="mb-1.5"
                  >
                    {showStripeKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">
                    Connected to Stripe
                  </span>
                </div>

                <Button variant="outline" size="md">
                  Update API Key
                </Button>
              </div>
            </div>

            {/* Venmo Section */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Venmo
              </h3>
              <Input
                label="Venmo Handle"
                name="venmoHandle"
                value={formData.venmoHandle}
                onChange={handleInputChange}
                placeholder="@yourhandle"
              />
            </div>

            {/* Zelle Section */}
            <div className="pb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Zelle
              </h3>
              <Input
                label="Zelle Phone Number"
                name="zellePhone"
                value={formData.zellePhone}
                onChange={handleInputChange}
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Credit Card Surcharge Section */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <Percent className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Credit Card Surcharge
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Pass processing fees to customers who pay by card
                  </p>
                </div>
              </div>

              <div className="space-y-4 ml-[52px]">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="surchargeEnabled"
                    name="surchargeEnabled"
                    checked={formData.surchargeEnabled}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="surchargeEnabled"
                    className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
                  >
                    Enable credit card surcharge
                  </label>
                </div>

                {formData.surchargeEnabled && (
                  <div className="space-y-4 pl-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Surcharge Rate (%)"
                        name="cardSurchargeRate"
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={formData.cardSurchargeRate}
                        onChange={handleInputChange}
                        placeholder="3.0"
                      />
                      <Input
                        label="Fee Label (shown to customer)"
                        name="surchargeLabel"
                        value={formData.surchargeLabel}
                        onChange={handleInputChange}
                        placeholder="Processing fee"
                      />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                      <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        A {formData.cardSurchargeRate}% surcharge will be added to credit card payments.
                        ACH bank transfers remain free for your customers.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Default Payment Terms */}
            <Select
              label="Default Payment Terms"
              name="defaultPaymentTerms"
              value={formData.defaultPaymentTerms}
              onChange={handleInputChange}
              options={paymentTermsOptions}
            />
          </div>
        </Card>

        {/* API Integrations */}
        <Card>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                API & Integrations
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Manage server-to-server connections, webhook delivery, and API access.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadVedaIntegration} disabled={vedaLoading} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', vedaLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {vedaMessage && (
            <div
              className={cn(
                'mb-5 flex items-center gap-3 rounded-lg border p-3 text-sm font-medium',
                vedaMessage.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
              )}
            >
              {vedaMessage.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {vedaMessage.text}
            </div>
          )}

          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
                    <Plug className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Veda EMR</h3>
                      {vedaState?.connections?.[0]?.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : vedaState?.connections?.[0] ? (
                        <Badge variant="warning">Paused</Badge>
                      ) : (
                        <Badge variant="default">Not connected</Badge>
                      )}
                      {vedaState?.isAllowedWorkspace ? (
                        <Badge variant="info">Physical Therapy 365 only</Badge>
                      ) : (
                        <Badge variant="danger">Wrong workspace</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      This integration is locked to the Physical Therapy 365 Rivio organization.
                    </p>
                  </div>
                </div>

                {vedaState?.connections?.[0] && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVedaConnection(vedaState.connections[0])}
                      loading={vedaSaving}
                      className="gap-2"
                    >
                      {vedaState.connections[0].is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {vedaState.connections[0].is_active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteVedaConnection(vedaState.connections[0])}
                      disabled={vedaSaving}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {!vedaLoading && vedaState && !vedaState.isAllowedWorkspace && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Veda EMR cannot be connected from this workspace.
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                  Current workspace: {vedaState.workspace?.business_name || 'Unknown'}. Required workspace: {vedaState.config.allowedRivioOrganizationName}.
                </p>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-slate-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">
                    Veda Organization
                  </h3>
                </div>

                <Input
                  label="Veda Organization ID"
                  name="vedaOrganizationId"
                  value={vedaForm.vedaOrganizationId}
                  onChange={handleVedaFormChange}
                  placeholder="veda_org_..."
                  disabled={Boolean(vedaState?.connections?.[0])}
                />
                <Input
                  label="Display Name"
                  name="displayName"
                  value={vedaForm.displayName}
                  onChange={handleVedaFormChange}
                  placeholder="Veda EMR"
                />
                <Input
                  label="Veda Webhook Base URL"
                  name="webhookBaseUrl"
                  value={vedaForm.webhookBaseUrl}
                  onChange={handleVedaFormChange}
                  placeholder="https://vedaemr.com"
                />
                <Textarea
                  label="Internal Notes"
                  name="notes"
                  value={vedaForm.notes}
                  onChange={handleVedaFormChange}
                  placeholder="Production Veda EMR connection for Physical Therapy 365"
                />
                <Button
                  onClick={saveVedaConnection}
                  loading={vedaSaving}
                  disabled={!vedaState?.isAllowedWorkspace || !vedaForm.vedaOrganizationId.trim()}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {vedaState?.connections?.[0] ? 'Save Integration' : 'Connect Veda'}
                </Button>
              </div>

              <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-slate-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">
                    Keys & Webhooks
                  </h3>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Veda to Rivio HMAC Secret</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{vedaState?.config.secrets.vedaToRivioSharedSecret || 'Loading'}</p>
                      </div>
                      <Badge variant={vedaState?.config.secrets.vedaToRivioSharedSecretConfigured ? 'success' : 'danger'}>
                        {vedaState?.config.secrets.vedaToRivioSharedSecretConfigured ? 'Configured' : 'Missing'}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Rivio to Veda Webhook Secret</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{vedaState?.config.secrets.rivioToVedaWebhookSecret || 'Loading'}</p>
                      </div>
                      <Badge variant={vedaState?.config.secrets.rivioToVedaWebhookSecretConfigured ? 'success' : 'danger'}>
                        {vedaState?.config.secrets.rivioToVedaWebhookSecretConfigured ? 'Configured' : 'Missing'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {vedaState &&
                    Object.entries(vedaState.config.endpoints).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{key}</p>
                          <p className="truncate font-mono text-xs text-slate-800 dark:text-slate-200">{value}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyText(value)} className="px-2">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">
                    Failed Webhook Deliveries
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Delivery failures are kept here with retry timing and response status.
                  </p>
                </div>
                <Badge variant={vedaState?.failedWebhookDeliveries?.length ? 'warning' : 'success'}>
                  {vedaState?.failedWebhookDeliveries?.length || 0} failed
                </Badge>
              </div>

              {!vedaState?.failedWebhookDeliveries?.length ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                  No failed Veda webhook deliveries.
                </p>
              ) : (
                <div className="space-y-2">
                  {vedaState.failedWebhookDeliveries.map((delivery) => (
                    <div key={delivery.id} className="rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs text-red-900 dark:text-red-200">{delivery.event_id}</p>
                        <Badge variant="danger">HTTP {delivery.response_status || 'error'}</Badge>
                      </div>
                      <p className="mt-2 break-all text-red-800 dark:text-red-300">{delivery.last_error || delivery.destination_url}</p>
                      <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                        Attempts: {delivery.attempt_count} · Next retry: {delivery.next_retry_at ? new Date(delivery.next_retry_at).toLocaleString() : 'not scheduled'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Invoice Defaults */}
        <Card>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Invoice Defaults
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Set default values for new invoices
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Default Tax Rate (%)"
                name="defaultTaxRate"
                type="number"
                step="0.01"
                min="0"
                value={formData.defaultTaxRate}
                onChange={handleInputChange}
                placeholder="8.625"
              />
              <Input
                label="Invoice Number Prefix"
                name="invoiceNumberPrefix"
                value={formData.invoiceNumberPrefix}
                onChange={handleInputChange}
                placeholder="PT"
                maxLength={5}
              />
            </div>

            <Textarea
              label="Default Notes/Terms"
              name="defaultNotes"
              value={formData.defaultNotes}
              onChange={handleInputChange}
              placeholder="Add default text that appears on all invoices..."
            />

            {/* Payment Reminder Settings */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="paymentReminder"
                  name="paymentReminderEnabled"
                  checked={formData.paymentReminderEnabled}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="paymentReminder"
                  className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
                >
                  Enable Payment Reminders
                </label>
              </div>

              {formData.paymentReminderEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Send Reminder (days before due)"
                    name="reminderDaysBefore"
                    type="number"
                    min="1"
                    value={formData.reminderDaysBefore}
                    onChange={handleInputChange}
                  />
                  <Input
                    label="Send Overdue Notice (days after due)"
                    name="reminderDaysAfter"
                    type="number"
                    min="1"
                    value={formData.reminderDaysAfter}
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Appearance
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Customize how the app looks
            </p>
          </div>

          <div className="space-y-8">
            {/* Theme Toggle */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Theme
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'system', label: 'System', icon: Monitor },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTheme(id as 'light' | 'dark')}
                    className={cn(
                      'relative p-4 rounded-lg border-2 transition-all duration-200',
                      theme === id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    )}
                  >
                    <Icon className={cn(
                      'w-6 h-6 mx-auto mb-2',
                      theme === id
                        ? 'text-blue-600'
                        : 'text-slate-600 dark:text-slate-400'
                    )} />
                    <p className={cn(
                      'text-sm font-medium',
                      theme === id
                        ? 'text-blue-900 dark:text-blue-300'
                        : 'text-slate-700 dark:text-slate-300'
                    )}>
                      {label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Color Picker */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Brand Color
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {brandColorPresets.map(preset => (
                  <button
                    key={preset.value}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200"
                  >
                    <div className={cn('w-12 h-12 rounded-lg', preset.class)} />
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">
                      {preset.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Security
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage your account security
            </p>
          </div>

          <div className="space-y-6">
            {/* Login Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email for Magic Link Login
              </label>
              <div className="flex gap-3">
                <Input
                  value={formData.email}
                  readOnly
                  className="flex-1"
                />
                <Button variant="outline" size="md">
                  Change Email
                </Button>
              </div>
            </div>

            {/* Session Info */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Active Sessions
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Current Session
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Chrome • San Francisco, CA • 192.168.1.1
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Last active: Just now
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              </div>
              <Button variant="outline" size="md" className="mt-4 gap-2">
                <LogOut className="w-4 h-4" />
                Log Out All Other Sessions
              </Button>
            </div>
          </div>
        </Card>

        {/* Footer spacing */}
        <div className="py-4" />
      </div>
    </div>
  );
}
