'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    // In production this would POST to an API route.
    // For now, simulate a brief delay and show a success message.
    await new Promise((r) => setTimeout(r, 800));
    setStatus('sent');
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-bold text-slate-900">Rivio</span>
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/privacy" className="hover:text-slate-900 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition">Terms</Link>
            <Link href="/login" className="text-blue-600 hover:text-blue-700 transition">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-2">Get in touch</p>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Contact Us</h1>
          <p className="text-slate-600 max-w-xl mx-auto">
            Have a question, found a bug, or want to share feedback? We'd love to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Contact Cards */}
          <div className="space-y-4">
            <ContactCard
              icon="✉️"
              title="Email"
              detail="support@rivio.app"
              href="mailto:support@rivio.app"
            />
            <ContactCard
              icon="🔒"
              title="Privacy"
              detail="privacy@rivio.app"
              href="mailto:privacy@rivio.app"
            />
            <ContactCard
              icon="⚖️"
              title="Legal"
              detail="legal@rivio.app"
              href="mailto:legal@rivio.app"
            />
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-blue-900 mb-1">Response time</p>
              <p className="text-sm text-blue-700">
                We typically respond within 1–2 business days.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              {status === 'sent' ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">✅</div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Message sent!</h2>
                  <p className="text-slate-600 mb-6">
                    Thanks for reaching out. We'll get back to you within 1–2 business days.
                  </p>
                  <button
                    onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: '', message: '' }); }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Send a message</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                        Your name
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={form.name}
                        onChange={update('name')}
                        required
                        placeholder="Jane Smith"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                        Email address
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={update('email')}
                        required
                        placeholder="jane@example.com"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">
                      Subject
                    </label>
                    <select
                      id="subject"
                      value={form.subject}
                      onChange={update('subject')}
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 bg-white"
                    >
                      <option value="">Select a topic...</option>
                      <option value="billing">Billing or payments</option>
                      <option value="bug">Bug report</option>
                      <option value="feature">Feature request</option>
                      <option value="account">Account issue</option>
                      <option value="privacy">Privacy or data</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                      Message
                    </label>
                    <textarea
                      id="message"
                      value={form.message}
                      onChange={update('message')}
                      required
                      rows={6}
                      placeholder="Tell us what's on your mind..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition text-slate-900 placeholder-slate-400 resize-none"
                    />
                  </div>

                  {status === 'error' && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      Something went wrong. Please try emailing us directly at{' '}
                      <a href="mailto:support@rivio.app" className="font-semibold underline">
                        support@rivio.app
                      </a>
                      .
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'sending' ? 'Sending...' : 'Send message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 mt-12">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© 2026 Rivio. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-slate-900 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition">Terms</Link>
            <Link href="/contact" className="hover:text-slate-900 transition font-medium text-slate-900">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactCard({
  icon,
  title,
  detail,
  href,
}: {
  icon: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition group"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-0.5">{title}</p>
        <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition">{detail}</p>
      </div>
    </a>
  );
}
