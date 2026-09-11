'use client';
import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

export const authClient = createAuthClient({ plugins: [inferAdditionalFields({ user: {
  businessName: { type: 'string', required: false },
} })] });

// Preserve the UI's existing user shape during the provider migration.
export function createBrowserAuthClient() {
  return { auth: {
    getUser: async () => {
      const result = await authClient.getSession();
      const user = result.data?.user;
      return { data: { user: user ? { id: user.id, email: user.email,
        user_metadata: { full_name: user.name, business_name: user.businessName },
      } : null }, error: result.error };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => authClient.signIn.email({ email, password }),
    signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string; business_name?: string } } }) =>
      authClient.signUp.email({ email, password, name: options?.data?.full_name || email, businessName: options?.data?.business_name || 'My Business' }),
    signOut: async () => authClient.signOut(),
    resetPasswordForEmail: async (email: string, options: { redirectTo: string }) => authClient.requestPasswordReset({ email, redirectTo: options.redirectTo }),
  } };
}
