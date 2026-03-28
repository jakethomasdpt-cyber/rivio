'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  FileText,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { formatCurrency, cn } from '@/lib/utils';

// Helper function for API calls
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  created_at: string;
  updated_at: string;
  invoiceCount: number;
  totalBilled: number;
}

interface FormErrors {
  name?: string;
  email?: string;
}

export default function ClientsPage() {
  // API state
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal and form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch('/api/clients');
        setClients(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  // Filter clients based on search
  const filteredClients = clients.filter(
    (client) =>
      (client.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.city || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Open modal for adding new client
  const handleAddClient = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      notes: '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  // Open modal for editing client
  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      state: client.state,
      zip: client.zip,
      notes: client.notes,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (editingClient) {
        // Update existing client
        await apiFetch(`/api/clients/${editingClient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // Add new client
        await apiFetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      // Refetch clients from API
      const data = await apiFetch('/api/clients');
      setClients(data);

      setIsModalOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete with confirmation
  const handleDeleteConfirm = async (clientId: string) => {
    try {
      setError(null);
      await apiFetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });

      // Refetch clients from API
      const data = await apiFetch('/api/clients');
      setClients(data);
      setIsDeleteConfirming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client');
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 mb-4">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Error
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            Clients
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your physical therapy clients
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={handleAddClient}
          className="w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="bg-white dark:bg-slate-800">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </Card>

      {/* Clients Grid or Empty State */}
      {filteredClients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title={searchQuery ? 'No clients found' : 'No clients yet'}
            description={
              searchQuery
                ? 'Try adjusting your search criteria'
                : 'Add your first client to get started'
            }
            action={
              !searchQuery && (
                <Button variant="primary" onClick={handleAddClient}>
                  <Plus className="w-4 h-4" />
                  Add Client
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-lg transition-shadow flex flex-col">
              {/* Client Header */}
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  {client.name}
                </h3>

                {/* Contact Info */}
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a
                      href={`mailto:${client.email}`}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {client.email}
                    </a>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <a
                        href={`tel:${client.phone}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {client.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              {(client.city || client.state) && (
                <div className="mb-4 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    {client.city}
                    {client.city && client.state && ', '}
                    {client.state}
                  </div>
                </div>
              )}

              {/* Notes */}
              {client.notes && (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {client.notes}
                  </p>
                </div>
              )}

              {/* Stats */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Invoices
                  </p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {(client as any).invoiceCount ?? 0}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Total Billed
                  </p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency((client as any).totalBilled ?? 0)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  title="Create new invoice for this client"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Invoice</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEditClient(client)}
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsDeleteConfirming(client.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? 'Edit Client' : 'Add New Client'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name and Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name *"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Client full name"
              error={errors.name}
            />
            <Input
              label="Email *"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="client@example.com"
              error={errors.email}
            />
          </div>

          {/* Phone and Address Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="555-0000"
            />
            <Input
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Street address"
            />
          </div>

          {/* City, State, ZIP Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
              placeholder="TX"
              maxLength={2}
            />
            <Input
              label="ZIP"
              name="zip"
              value={formData.zip}
              onChange={handleInputChange}
              placeholder="75001"
            />
          </div>

          {/* Notes */}
          <Textarea
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Add any additional notes about the client..."
          />

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving...' : (editingClient ? 'Update Client' : 'Add Client')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!isDeleteConfirming}
        onClose={() => setIsDeleteConfirming(null)}
        title="Delete Client"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              Are you sure you want to delete{' '}
              <strong>
                {clients.find((c) => c.id === isDeleteConfirming)?.name}
              </strong>
              ? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirming(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                isDeleteConfirming && handleDeleteConfirm(isDeleteConfirming)
              }
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
