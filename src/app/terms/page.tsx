import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Rivio',
  description: 'Terms and conditions for using Rivio.',
};

export default function TermsPage() {
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
            <Link href="/contact" className="hover:text-slate-900 transition">Contact</Link>
            <Link href="/login" className="text-blue-600 hover:text-blue-700 transition">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Terms of Service</h1>
          <p className="text-slate-500 text-sm">Last updated: March 28, 2026</p>
        </div>

        <div className="space-y-8">
          <Section title="Acceptance of Terms">
            <p>
              By accessing or using Rivio ("the Service"), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use the Service.
            </p>
            <p>
              These terms apply to all users, including practice owners, administrators, and any
              other individuals who access the Service.
            </p>
          </Section>

          <Section title="Description of Service">
            <p>
              Rivio is an invoicing and payment management platform for service professionals and
              small businesses across any industry. The Service allows you to create and send
              invoices, manage clients, track payments, and provide a client-facing payment portal.
            </p>
            <p>
              Rivio is not a financial institution, bank, or payment processor. Payment processing
              is provided by Stripe, Inc., subject to Stripe's own Terms of Service.
            </p>
          </Section>

          <Section title="Account Registration">
            <p>
              You must create an account to use most features of the Service. You are responsible
              for maintaining the confidentiality of your account credentials and for all activity
              that occurs under your account.
            </p>
            <p>
              You agree to provide accurate, current, and complete information during registration
              and to update that information to keep it accurate. You must be at least 18 years old
              to create an account.
            </p>
          </Section>

          <Section title="Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mt-2">
              <li>Send fraudulent, misleading, or deceptive invoices</li>
              <li>Impersonate another person or business</li>
              <li>Transmit spam or unsolicited commercial email</li>
              <li>Violate any applicable law or regulation</li>
              <li>Attempt to gain unauthorized access to the Service or its infrastructure</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
            </ul>
            <p className="mt-4">
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </Section>

          <Section title="Financial Transactions">
            <p>
              Rivio facilitates payments between you and your clients. You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mt-2">
              <li>The accuracy of all invoice amounts</li>
              <li>Compliance with applicable tax laws and regulations</li>
              <li>Any disputes with your clients regarding services rendered</li>
              <li>Maintaining your Stripe account in good standing</li>
            </ul>
            <p className="mt-4">
              Rivio is not responsible for failed payments, chargebacks, or disputes between you
              and your clients. Stripe fees are governed by Stripe's pricing and are separate from
              any Rivio fees.
            </p>
          </Section>

          <Section title="Data and Privacy">
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. By using the Service, you
              consent to our data practices as described in the Privacy Policy.
            </p>
            <p>
              You retain ownership of all data you input into Rivio, including client information
              and invoice records. You grant us a limited license to process and store this data
              solely to provide the Service.
            </p>
          </Section>

          <Section title="Intellectual Property">
            <p>
              The Service, including its design, code, and branding, is owned by Rivio and is
              protected by intellectual property laws. You may not copy, modify, distribute, or
              create derivative works without our express written permission.
            </p>
          </Section>

          <Section title="Disclaimers">
            <p>
              The Service is provided "as is" and "as available" without warranties of any kind,
              express or implied. We do not warrant that the Service will be uninterrupted,
              error-free, or secure.
            </p>
            <p>
              Rivio is not a licensed financial advisor, accountant, or attorney. Nothing in the
              Service constitutes financial, tax, or legal advice. Consult a qualified professional
              for such matters.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, Rivio shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising from your
              use of the Service, including lost profits, lost data, or business interruption.
            </p>
            <p>
              Our total liability to you for any claims arising from use of the Service shall not
              exceed the amount you paid to Rivio in the twelve months preceding the claim.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You may terminate your account at any time by contacting us. We may suspend or
              terminate your access to the Service at any time for violation of these Terms or for
              any other reason at our discretion, with or without notice.
            </p>
            <p>
              Upon termination, your right to use the Service ceases immediately. You may request
              an export of your data before account deletion.
            </p>
          </Section>

          <Section title="Changes to Terms">
            <p>
              We reserve the right to modify these Terms at any time. We will provide notice of
              significant changes via email or an in-app notification at least 14 days before they
              take effect. Continued use of the Service after the effective date constitutes
              acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="Governing Law">
            <p>
              These Terms are governed by the laws of the State of Texas, without regard to
              conflict of law principles. Any disputes arising from these Terms or use of the
              Service shall be subject to the exclusive jurisdiction of the state and federal
              courts located in Texas.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these Terms? Contact us at{' '}
              <Link href="/contact" className="text-blue-600 hover:underline">
                our contact page
              </Link>{' '}
              or email{' '}
              <a href="mailto:legal@rivio.app" className="text-blue-600 hover:underline">
                legal@rivio.app
              </a>
              .
            </p>
          </Section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 mt-12">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© 2026 Rivio. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-slate-900 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition font-medium text-slate-900">Terms</Link>
            <Link href="/contact" className="hover:text-slate-900 transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <h2 className="text-xl font-bold text-slate-900 mb-4">{title}</h2>
      <div className="text-slate-700 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}
