'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold">
            <span className="text-blue-600">⚡</span>
            <span className="text-slate-900 tracking-tight">Rivio</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-slate-500 hover:text-slate-900 font-medium transition text-sm">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-slate-900 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-800 transition text-sm"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      <section className="pt-36 pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {['White-labeled invoices', 'Custom card/ACH fees', 'Mileage tracking', 'Fast payment links'].map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide"
                >
                  {pill}
                </span>
              ))}
            </div>

            <h1 className="text-5xl md:text-[3.5rem] lg:text-[4rem] font-headline font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
              Your practice. Your brand.
              <br />
              <span className="text-blue-600">Your payments.</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10">
              The PT-first invoicing app that lets you white-label your clinic, control processing fees, track mileage, and get paid faster from anywhere.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
              <Link
                href="/signup"
                className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25 text-base"
              >
                Create your first invoice
              </Link>
              <a
                href="#how-it-works"
                className="border border-slate-200 text-slate-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-300 transition text-base"
              >
                See how it works
              </a>
            </div>

            <p className="text-sm text-slate-400">
              Built for mobile PTs, cash-pay clinics, and modern rehab practices.
            </p>
          </div>

          {/* ─── Invoice Mockup ──────────────────────────────────────── */}
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
              {/* Header bar */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-7 py-5 flex items-center justify-between">
                <div>
                  <div className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Invoice</div>
                  <div className="text-white font-headline font-bold text-lg tracking-tight">#PT-001</div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <span className="text-emerald-300 text-xs font-semibold">Paid</span>
                </div>
              </div>

              <div className="p-7 space-y-6">
                {/* Bill To */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Bill To</div>
                  <div className="font-semibold text-slate-900">Sarah Johnson</div>
                  <div className="text-sm text-slate-500">sarah.johnson@email.com</div>
                </div>

                {/* Line Items */}
                <div className="border-t border-slate-100 pt-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2.5 font-semibold text-slate-400 text-xs uppercase tracking-wide">Service</th>
                        <th className="text-right pb-2.5 font-semibold text-slate-400 text-xs uppercase tracking-wide">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-50">
                        <td className="py-3 text-slate-800 font-medium">PT Treatment Session</td>
                        <td className="text-right text-slate-700">$175.00</td>
                      </tr>
                      <tr className="border-b border-slate-50">
                        <td className="py-3 text-slate-800 font-medium">Travel / Mileage</td>
                        <td className="text-right text-slate-700">$18.00</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-slate-500 text-xs">Processing Fee (3%)</td>
                        <td className="text-right text-slate-500 text-xs">$5.40</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="flex justify-between items-end pt-4 border-t border-slate-200">
                  <span className="text-sm text-slate-400 font-medium">Total Due</span>
                  <span className="text-2xl font-bold text-slate-900 tracking-tight">$198.40</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Section ─────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-slate-900 tracking-tight">
              Built for how physical therapists actually work
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Feature 1 */}
            <div className="group bg-white p-8 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">White-label your clinic</h3>
              <p className="text-slate-500 leading-relaxed">
                Add your logo, colors, business name, and branded payment experience so patients see your practice — not another billing platform.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white p-8 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">Control your processing fees</h3>
              <p className="text-slate-500 leading-relaxed">
                Accept card or ACH payments and decide how fees are handled so your margins stay protected.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white p-8 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">Track every mile</h3>
              <p className="text-slate-500 leading-relaxed">
                Built-in mileage tracking helps mobile PTs capture travel costs without spreadsheets or separate apps.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group bg-white p-8 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">Get paid faster</h3>
              <p className="text-slate-500 leading-relaxed">
                Send clean payment links patients can open, review, and pay from their phone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-slate-900 tracking-tight">
              From visit to paid — without the admin drag
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-headline font-bold text-lg mx-auto mb-5 shadow-lg shadow-blue-600/20">
                1
              </div>
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">Treat the patient</h3>
              <p className="text-slate-500 leading-relaxed">
                Create or select the patient and service details after the visit.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-headline font-bold text-lg mx-auto mb-5 shadow-lg shadow-blue-600/20">
                2
              </div>
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">Send a branded invoice</h3>
              <p className="text-slate-500 leading-relaxed">
                Add treatment charges, mileage, and payment preferences in seconds.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-headline font-bold text-lg mx-auto mb-5 shadow-lg shadow-blue-600/20">
                3
              </div>
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">Get paid and stay organized</h3>
              <p className="text-slate-500 leading-relaxed">
                Track paid, unpaid, and overdue invoices from one clean dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing Section ──────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-50/60 to-white">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-slate-900 tracking-tight mb-4">
            Simple pricing
          </h2>
          <p className="text-slate-500 mb-12">
            Perfect for mobile PTs and cash-pay clinics.
          </p>

          <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-xl shadow-slate-200/40">
            <div className="mb-8">
              <span className="text-5xl font-bold text-slate-900 tracking-tight">$0</span>
              <span className="text-slate-400 text-base ml-1">/month during beta</span>
            </div>

            <div className="mb-10 text-left space-y-3.5">
              {[
                'Unlimited invoices',
                'White-labeled clinic branding',
                'Card and ACH payment links',
                'Custom processing fee control',
                'Mileage tracking',
                'Client payment portal',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-slate-700 text-sm">{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="block w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold hover:bg-slate-800 transition text-center"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-slate-900 tracking-tight mb-5">
            Stop forcing generic invoice tools
            <br className="hidden sm:block" />
            into a PT workflow.
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Use Rivio to send branded invoices, collect payments, and track mileage from one clean system built for physical therapists.
          </p>
          <Link
            href="/signup"
            className="inline-flex bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25 text-base"
          >
            Create your first invoice
          </Link>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 sm:mb-0">
            <span className="text-blue-600">⚡</span>
            <span className="text-slate-400 text-sm">Rivio © 2026</span>
          </div>
          <div className="flex gap-6 text-slate-400 text-sm">
            <Link href="/privacy" className="hover:text-slate-700 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-700 transition">Terms</Link>
            <Link href="/contact" className="hover:text-slate-700 transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
