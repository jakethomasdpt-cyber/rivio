'use client';
import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export interface Workspace {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  brand_color: string | null;
  logo_url: string | null;
  venmo_handle: string | null;
  zelle_phone: string | null;
  invoice_prefix: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  invoice_footer: string | null;
  tax_rate_default: number | null;
}

export interface User {
  id: string;
  email: string | null;
  user_metadata: { full_name?: string; business_name?: string };
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const supabase = createBrowserSupabaseClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUser(authUser as User);
          const res = await fetch('/api/workspace');
          if (res.ok) {
            const ws = await res.json();
            setWorkspace(ws);
          } else if (res.status !== 404) {
            throw new Error('Failed to fetch workspace');
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error('Unknown error');
        console.error('useWorkspace error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { workspace, user, loading, error };
}
