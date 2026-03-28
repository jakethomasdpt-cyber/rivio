'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check password match in real-time
    if (name === 'password' || name === 'confirmPassword') {
      const pass = name === 'password' ? value : formData.password;
      const confirm = name === 'confirmPassword' ? value : formData.confirmPassword;
      setPasswordMismatch(pass !== confirm && confirm !== '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            business_name: formData.businessName,
          },
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Redirect to onboarding
      router.push('/onboarding');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center mb-12">
          <span className="text-3xl">⚡</span>
          <span className="text-2xl font-bold text-slate-900 font-headline">Rivio</span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <h1 className="text-3xl font-headline font-bold text-slate-900 mb-2 text-center">Create your account</h1>
          <p className="text-slate-600 text-center mb-8">Join hundreds of professionals getting paid faster</p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Field */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-900 mb-2">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Sarah Johnson"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
              />
            </div>

            {/* Business Name Field */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-slate-900 mb-2">
                Business/Practice name
              </label>
              <input
                id="businessName"
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                placeholder="Johnson Physical Therapy"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
              />
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-900 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-900 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-500"
              />
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-900 mb-2">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition text-slate-900 placeholder-slate-500 ${
                  passwordMismatch ? 'border-red-300 focus:ring-red-600' : 'border-slate-300 focus:ring-blue-600'
                }`}
              />
              {passwordMismatch && <p className="mt-1 text-sm text-red-600">Passwords do not match</p>}
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading || passwordMismatch}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-base mt-6"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-slate-600 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>

          {/* Beta Note */}
          <p className="text-center text-slate-500 text-sm mt-6 pt-6 border-t border-slate-200">
            Free during beta · No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
