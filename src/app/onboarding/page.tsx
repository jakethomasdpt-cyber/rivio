'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    brandColor: '#004a99',
    venmoHandle: '',
    zellePhone: '',
    invoicePrefix: 'INV',
  });

  // Get user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push('/login');
        return;
      }

      setUserEmail(data.user.email || '');
      setFormData((prev) => ({
        ...prev,
        businessName: data.user.user_metadata?.business_name || '',
        ownerName: data.user.user_metadata?.full_name || '',
        email: data.user.email || '',
      }));
    };

    fetchUser();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  const handleNext = () => {
    if (step === 1) {
      // Validate step 1
      if (!formData.businessName || !formData.ownerName || !formData.email) {
        setError('Please fill in all required fields');
        return;
      }
      setError('');
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save workspace settings');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="text-3xl">⚡</span>
          <span className="text-2xl font-bold text-slate-900 font-headline">Rivio</span>
        </Link>

        {/* Step Indicator */}
        <div className="flex justify-center gap-3 mb-12">
          <div
            className={`h-2 w-12 rounded-full transition ${step >= 1 ? 'bg-blue-600' : 'bg-slate-300'}`}
          />
          <div
            className={`h-2 w-12 rounded-full transition ${step >= 2 ? 'bg-blue-600' : 'bg-slate-300'}`}
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          {/* Step 1: Business Information */}
          {step === 1 && (
            <>
              <h1 className="text-3xl font-headline font-bold text-slate-900 mb-2">Tell us about your business</h1>
              <p className="text-slate-600 mb-8">We'll use this to set up your workspace and create professional invoices.</p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-5">
                {/* Business Name */}
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-slate-900 mb-2">
                    Business/Practice name *
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    placeholder="Johnson Physical Therapy"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                </div>

                {/* Owner Name */}
                <div>
                  <label htmlFor="ownerName" className="block text-sm font-medium text-slate-900 mb-2">
                    Your name *
                  </label>
                  <input
                    id="ownerName"
                    type="text"
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleChange}
                    placeholder="Sarah Johnson"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-900 mb-2">
                    Email address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-900 mb-2">
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-slate-900 mb-2">
                    Street address
                  </label>
                  <input
                    id="address"
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123 Main St"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                </div>

                {/* City, State, ZIP */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-slate-900 mb-2">
                      City
                    </label>
                    <input
                      id="city"
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Portland"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-slate-900 mb-2">
                        State
                      </label>
                      <input
                        id="state"
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="OR"
                        maxLength={2}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="zip" className="block text-sm font-medium text-slate-900 mb-2">
                        ZIP
                      </label>
                      <input
                        id="zip"
                        type="text"
                        name="zip"
                        value={formData.zip}
                        onChange={handleChange}
                        placeholder="97201"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="flex-1 text-slate-600 py-3 rounded-lg font-semibold hover:bg-slate-100 transition text-base"
                  >
                    Skip for now
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-base"
                  >
                    Next
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Step 2: Branding & Payments */}
          {step === 2 && (
            <>
              <h1 className="text-3xl font-headline font-bold text-slate-900 mb-2">Branding & Payments</h1>
              <p className="text-slate-600 mb-8">Customize your workspace and set up payment methods.</p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Brand Color */}
                <div>
                  <label htmlFor="brandColor" className="block text-sm font-medium text-slate-900 mb-2">
                    Brand color
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      id="brandColor"
                      type="color"
                      name="brandColor"
                      value={formData.brandColor}
                      onChange={handleChange}
                      className="h-12 w-20 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.brandColor}
                      onChange={(e) => setFormData((prev) => ({ ...prev, brandColor: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500 font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Invoice Number Prefix */}
                <div>
                  <label htmlFor="invoicePrefix" className="block text-sm font-medium text-slate-900 mb-2">
                    Invoice number prefix
                  </label>
                  <input
                    id="invoicePrefix"
                    type="text"
                    name="invoicePrefix"
                    value={formData.invoicePrefix}
                    onChange={handleChange}
                    placeholder="INV"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                  <p className="text-sm text-slate-500 mt-1">e.g., INV-001, INV-002...</p>
                </div>

                {/* Venmo Handle */}
                <div>
                  <label htmlFor="venmoHandle" className="block text-sm font-medium text-slate-900 mb-2">
                    Venmo handle (optional)
                  </label>
                  <input
                    id="venmoHandle"
                    type="text"
                    name="venmoHandle"
                    value={formData.venmoHandle}
                    onChange={handleChange}
                    placeholder="@yourname"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                </div>

                {/* Zelle Phone */}
                <div>
                  <label htmlFor="zellePhone" className="block text-sm font-medium text-slate-900 mb-2">
                    Zelle phone or email (optional)
                  </label>
                  <input
                    id="zellePhone"
                    type="text"
                    name="zellePhone"
                    value={formData.zellePhone}
                    onChange={handleChange}
                    placeholder="(555) 123-4567 or your@email.com"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
                  />
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                  <p className="font-medium mb-1">Stripe integration</p>
                  <p>You'll be able to connect your Stripe account after setup to accept card payments on your client portal.</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 text-slate-600 py-3 rounded-lg font-semibold hover:bg-slate-100 transition text-base"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    {loading ? 'Completing setup...' : 'Complete setup'}
                  </button>
                </div>
              </form>

              {/* Skip Link */}
              <button
                onClick={handleSkip}
                className="w-full text-slate-600 text-sm hover:text-slate-900 mt-6"
              >
                Skip for now
              </button>
            </>
          )}
        </div>

        {/* Progress Text */}
        <p className="text-center text-slate-500 text-sm mt-8">
          Step {step} of 2
        </p>
      </div>
    </div>
  );
}
