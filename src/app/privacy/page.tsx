import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Rivio',
  description: 'How Rivio collects, uses, and protects your data.',
};

export default function PrivacyPage() {
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
            <Link href="/terms" className="hover:text-slate-900 transition">Terms</Link>
            <Link href="/contact" className="hover:text-slate-900 transition">Contact</Link>
            <Link href="/login" className="text-blue-600 hover:text-blue-700 transition">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: March 28, 2026</p>
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Note:</strong> This policy is provided for informational purposes. It is not
            a substitute for advice from a licensed attorney. Users in regulated industries
            (healthcare, finance, legal, etc.) should consult qualified counsel to ensure their
            own compliance obligations are met.
          </div>
        </div>

        <div className="space-y-6">
          <Section title="1. Who We Are">
            <p>
              Rivio ("we," "our," or "us") is an invoicing and payment management platform open
              to any service professional or small business. Rivio provides tools to create and
              send invoices, manage clients, accept payments, and track finances — all under each
              user's own branded workspace.
            </p>
            <p>
              Rivio is not itself a healthcare provider and does not provide medical services.
              Users who operate healthcare practices are solely responsible for any HIPAA
              obligations that apply to their own practice and patient relationships.
            </p>
            <p>
              For questions about this policy, contact{' '}
              <a href="mailto:privacy@rivio.app" className="text-blue-600 hover:underline">
                privacy@rivio.app
              </a>
              .
            </p>
          </Section>

          <Section title="2. What Information Rivio Collects">
            <Subsection title="Account information">
              Name, email address, and password (stored as a one-way hash — never in plain text)
              when you create an account.
            </Subsection>
            <Subsection title="Business profile">
              Business name, address, phone number, website, and payment handles (e.g. Venmo
              username, Zelle phone number) that you enter in your workspace settings. This
              information is used solely to populate invoices sent on your behalf.
            </Subsection>
            <Subsection title="Client and billing data">
              Client names, email addresses, phone numbers, billing addresses, and invoice records
              (line items, service dates, amounts, payment status) that you enter into the
              platform. This data is stored in your private workspace and is not accessible to
              other Rivio accounts.
            </Subsection>
            <Subsection title="Payment data">
              Rivio does not store credit card numbers, bank account numbers, or routing numbers.
              Online payments are processed by Stripe, Inc. directly. Rivio receives only a
              payment confirmation and transaction ID from Stripe.
            </Subsection>
            <Subsection title="Usage and technical data">
              Basic server logs (IP address, browser type, pages visited, timestamps) are
              retained for up to 90 days for security and debugging purposes. Rivio does not
              use third-party analytics trackers or advertising pixels.
            </Subsection>
            <Subsection title="Cookies">
              Rivio uses a single session authentication cookie set by Supabase to keep you
              signed in. No advertising, cross-site tracking, or third-party cookies are used.
            </Subsection>
          </Section>

          <Section title="3. How Rivio Uses Information">
            <p>Information is used only for the following purposes:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mt-3">
              <li>Providing and operating the Rivio platform</li>
              <li>Generating and delivering invoices on your behalf</li>
              <li>Processing payments through Stripe</li>
              <li>Sending invoice-related transactional emails via Resend</li>
              <li>Maintaining platform security and preventing fraud</li>
              <li>Improving the platform based on aggregated, anonymized usage patterns</li>
              <li>Complying with legal obligations</li>
            </ul>
            <p className="mt-4 font-medium text-slate-900">
              Rivio does not sell personal data. Rivio does not use personal data for advertising.
            </p>
          </Section>

          <Section title="4. Legal Basis for Processing (GDPR)">
            <p>
              For users in the European Economic Area or United Kingdom, Rivio processes personal
              data under the following lawful bases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mt-3">
              <li>
                <strong>Contract performance</strong> — processing your account data and client
                data is necessary to provide the service you signed up for
              </li>
              <li>
                <strong>Legitimate interests</strong> — server logs and security monitoring are
                necessary to protect the platform and its users
              </li>
              <li>
                <strong>Legal obligation</strong> — retaining certain records as required by law
              </li>
            </ul>
          </Section>

          <Section title="5. Third-Party Services">
            <p>
              Rivio shares the minimum necessary data with the following third-party services
              to operate the platform:
            </p>
            <div className="mt-4 space-y-4">
              <ThirdParty
                name="Supabase"
                use="Database hosting and user authentication"
                link="https://supabase.com/privacy"
                data="Account credentials, all stored workspace data"
              />
              <ThirdParty
                name="Stripe"
                use="Payment processing"
                link="https://stripe.com/privacy"
                data="Invoice amount, invoice ID, client email for payment"
              />
              <ThirdParty
                name="Resend"
                use="Transactional email delivery"
                link="https://resend.com/legal/privacy-policy"
                data="Recipient email address, invoice content for sending"
              />
            </div>
            <p className="mt-4 text-sm text-slate-600">
              No other third parties receive personal data from Rivio.
            </p>
          </Section>

          <Section title="6. Do Not Track">
            <p>
              Rivio honors Do Not Track (DNT) browser signals. Because Rivio does not use
              cross-site tracking or behavioral advertising, DNT signals have no material effect
              on your experience — the platform behaves the same regardless of your DNT setting.
              This disclosure is provided in compliance with the California Online Privacy
              Protection Act (CalOPPA).
            </p>
          </Section>

          <Section title="7. Data Security">
            <p>
              All data is encrypted in transit (TLS 1.2+) and encrypted at rest in Supabase.
              Access to your data is enforced at the database level through row-level security
              policies — your workspace data is cryptographically isolated from all other accounts.
            </p>
            <p>
              Invoice portal links use 256-bit cryptographically random tokens (generated via
              Node.js <code className="bg-slate-100 px-1 rounded text-sm">crypto.randomBytes</code>)
              with a 90-day expiration. Expired links return an error and cannot be replayed.
            </p>
            <p>
              No security system is 100% guaranteed. In the event of a breach affecting your
              data, Rivio will notify you by email within 72 hours of discovery, consistent
              with GDPR Article 33 obligations.
            </p>
          </Section>

          <Section title="8. Data Retention">
            <p>
              Account and workspace data is retained for as long as your account is active. If
              you delete your account, personal data will be deleted within 30 days, except:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mt-3">
              <li>
                Financial records (invoice amounts, payment confirmations) may be retained for
                up to 7 years to comply with tax and accounting obligations
              </li>
              <li>
                Server security logs are retained for 90 days then automatically purged
              </li>
            </ul>
          </Section>

          <Section title="9. Your Rights">
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mt-3">
              <li>
                <strong>Access</strong> — request a copy of the personal data Rivio holds about
                you
              </li>
              <li>
                <strong>Correction</strong> — request correction of inaccurate data (most data
                can be updated directly in your account settings)
              </li>
              <li>
                <strong>Deletion</strong> — request deletion of your account and personal data
              </li>
              <li>
                <strong>Portability</strong> — request an export of your data in a
                machine-readable format
              </li>
              <li>
                <strong>Objection</strong> — object to processing based on legitimate interests
              </li>
              <li>
                <strong>California residents (CCPA)</strong> — have the right to know what
                personal information is collected, to delete it, and to opt out of its sale
                (Rivio does not sell personal information)
              </li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, email{' '}
              <a href="mailto:privacy@rivio.app" className="text-blue-600 hover:underline">
                privacy@rivio.app
              </a>{' '}
              with your request. Rivio will respond within 30 days.
            </p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              Rivio is not directed at individuals under the age of 18 and does not knowingly
              collect personal information from minors. If you believe a minor has provided
              information through Rivio, contact{' '}
              <a href="mailto:privacy@rivio.app" className="text-blue-600 hover:underline">
                privacy@rivio.app
              </a>{' '}
              and the data will be deleted promptly.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              Rivio may update this Privacy Policy from time to time. For material changes,
              notice will be provided by email to the address on your account at least 14 days
              before the change takes effect. The "Last updated" date at the top of this page
              reflects the most recent revision. Continued use of the platform after the
              effective date constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>For privacy-related questions or data requests:</p>
            <div className="mt-3 space-y-1 text-slate-700">
              <p>
                Email:{' '}
                <a href="mailto:privacy@rivio.app" className="text-blue-600 hover:underline">
                  privacy@rivio.app
                </a>
              </p>
              <p>
                General support:{' '}
                <Link href="/contact" className="text-blue-600 hover:underline">
                  Contact page
                </Link>
              </p>
            </div>
          </Section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 mt-12">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© 2026 Rivio. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="font-medium text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition">Terms</Link>
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

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-slate-700">{children}</p>
    </div>
  );
}

function ThirdParty({
  name,
  use,
  link,
  data,
}: {
  name: string;
  use: string;
  link: string;
  data: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-900">{name}</p>
          <p className="text-sm text-slate-600 mt-0.5">{use}</p>
          <p className="text-xs text-slate-500 mt-1">Data shared: {data}</p>
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline whitespace-nowrap flex-shrink-0"
        >
          Privacy policy ↗
        </a>
      </div>
    </div>
  );
}
