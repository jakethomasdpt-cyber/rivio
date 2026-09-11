import 'server-only';
import { betterAuth } from 'better-auth';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { nextCookies } from 'better-auth/next-js';
import { compare } from 'bcryptjs';
import { Resend } from 'resend';
import { getDatabasePool } from './database';

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseURL) throw new Error('BETTER_AUTH_URL is required');
  return betterAuth({
    appName: 'Rivio',
    baseURL,
    secret,
    database: getDatabasePool(),
    advanced: { database: { generateId: 'uuid' } },
    user: { modelName: 'auth_user', additionalFields: { businessName: { type: 'string', required: false, defaultValue: 'My Business' } } },
    account: { modelName: 'auth_account' },
    session: { modelName: 'auth_session', expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    verification: { modelName: 'auth_verification' },
    rateLimit: { enabled: true, storage: 'database', modelName: 'auth_rate_limit', window: 60, max: 60 },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPassword,
        verify: async ({ hash, password }) => /^\$2[aby]\$/.test(hash)
          ? compare(password, hash.replace(/^\$2y\$/, '$2b$'))
          : verifyPassword({ hash, password }),
      },
      sendResetPassword: async ({ user, url }) => {
        if (!process.env.RESEND_API_KEY) throw new Error('Email delivery is not configured');
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: process.env.AUTH_EMAIL_FROM || 'Rivio <invoices@physicaltherapy365.com>',
          to: user.email,
          subject: 'Reset your Rivio password',
          text: `Use this link to reset your Rivio password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
        });
        if (result.error) throw new Error('Password reset email could not be sent');
      },
    },
    plugins: [nextCookies()],
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
