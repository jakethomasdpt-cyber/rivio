'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <span className="text-blue-600">⚡</span>
            <span className="text-slate-900">Rivio</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-slate-600 hover:text-slate-900 font-medium transition">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-md hover:shadow-lg"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-headline font-bold text-slate-900 mb-6 leading-tight">
            Invoice smarter.<br />Get paid faster.
          </h1>
          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Forget QuickBooks complexity. Send professional invoices, accept payments via Stripe, Venmo, or Zelle, and track your finances—all in one beautiful platform built for service professionals.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/signup"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg hover:shadow-xl text-lg"
            >
              Start free
            </Link>
            <a
              href="#how-it-works"
              className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-blue-50 transition text-lg"
            >
              See how it works
            </a>
          </div>

          {/* Hero Preview Mockup */}
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="font-headline font-bold text-lg">INVOICE #INV-001</div>
              <div className="text-sm opacity-90">March 27, 2026</div>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">Bill To</div>
                <div className="font-semibold text-slate-900">Acme Corp</div>
                <div className="text-slate-600">contact@acme.com</div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 font-semibold text-slate-900">Description</th>
                      <th className="text-right py-2 font-semibold text-slate-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-3 text-slate-700">Professional Services</td>
                      <td className="text-right text-slate-700">$1,500.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="text-right">
                  <div className="text-sm text-slate-600 mb-1">Total Due</div>
                  <div className="text-3xl font-bold text-blue-600">$1,500.00</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-headline font-bold text-center text-slate-900 mb-16">
            Everything you need to invoice like a pro
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-3">Beautiful Invoices</h3>
              <p className="text-slate-600">Send professional invoices via email in seconds. Every invoice is branded with your colors and logo.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-3">Flexible Payments</h3>
              <p className="text-slate-600">Accept payments however your clients prefer—Stripe, Venmo, or Zelle. Get paid instantly.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-3">Your Data, Your Brand</h3>
              <p className="text-slate-600">Every workspace is private and fully branded with your logo, colors, and custom domain.</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-3">Finance at a Glance</h3>
              <p className="text-slate-600">Upload bank statements and track income automatically. See exactly where your money is.</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-3">Client Portal</h3>
              <p className="text-slate-600">Clients get a private link to view invoices, download receipts, and pay securely online.</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-xl border border-slate-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-3">Replace QuickBooks</h3>
              <p className="text-slate-600">Built for small service businesses at a fraction of the cost. No accountant required.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-headline font-bold text-center text-slate-900 mb-16">
            Get started in three simple steps
          </h2>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-headline font-bold text-lg">
                1
              </div>
              <div>
                <h3 className="text-2xl font-headline font-bold text-slate-900 mb-2">Create your account</h3>
                <p className="text-lg text-slate-600">Sign up in seconds and add your branding. Upload your logo, choose your colors, and set your payment preferences.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-headline font-bold text-lg">
                2
              </div>
              <div>
                <h3 className="text-2xl font-headline font-bold text-slate-900 mb-2">Add clients and send invoices</h3>
                <p className="text-lg text-slate-600">Create a library of clients, then generate and send invoices in seconds. Track who's paid and who hasn't.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-headline font-bold text-lg">
                3
              </div>
              <div>
                <h3 className="text-2xl font-headline font-bold text-slate-900 mb-2">Get paid instantly</h3>
                <p className="text-lg text-slate-600">Clients pay via Stripe, Venmo, or Zelle. Payments post automatically and your dashboard updates in real time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-headline font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-slate-600 mb-16">Try Rivio free. Upgrade only when you're ready.</p>

          <div className="bg-white rounded-2xl border-2 border-blue-600 p-12 shadow-xl">
            <h3 className="text-3xl font-headline font-bold text-slate-900 mb-2">Professional</h3>
            <p className="text-slate-600 mb-8">Perfect for service professionals</p>

            <div className="mb-8">
              <span className="text-5xl font-bold text-blue-600">$0</span>
              <span className="text-slate-600 text-lg">/month during beta</span>
            </div>

            <div className="mb-12 text-left space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-blue-600 text-xl">✓</span>
                <span className="text-slate-700">Unlimited invoices</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-600 text-xl">✓</span>
                <span className="text-slate-700">Accept payments (Stripe, Venmo, Zelle)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-600 text-xl">✓</span>
                <span className="text-slate-700">Client payment portal</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-600 text-xl">✓</span>
                <span className="text-slate-700">Finance tracking and reports</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-600 text-xl">✓</span>
                <span className="text-slate-700">Bank statement uploads</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-600 text-xl">✓</span>
                <span className="text-slate-700">Full branding customization</span>
              </div>
            </div>

            <Link
              href="/signup"
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-headline font-bold text-white mb-6">Ready to get paid?</h2>
          <p className="text-xl text-blue-50 mb-8">Join hundreds of service professionals who've ditched QuickBooks. Create your free account in 30 seconds.</p>
          <Link
            href="/signup"
            className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-blue-50 transition shadow-lg text-lg"
          >
            Create your free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 sm:mb-0">
            <span className="text-blue-600">⚡</span>
            <span className="text-slate-600">Rivio © 2026</span>
          </div>
          <div className="flex gap-6 text-slate-600 text-sm">
            <Link href="/privacy" className="hover:text-slate-900 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition">Terms</Link>
            <Link href="/contact" className="hover:text-slate-900 transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
