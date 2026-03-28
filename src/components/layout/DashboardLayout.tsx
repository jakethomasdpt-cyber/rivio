'use client';
import Sidebar from './Sidebar';
import ThemeProvider from './ThemeProvider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Settings, ChevronDown } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { workspace, user, loading } = useWorkspace();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = workspace?.business_name
    ? workspace.business_name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'RV';

  return (
    <ThemeProvider>
      <div className="app-shell flex min-h-screen">
        <Sidebar workspace={workspace} />
        <main className="ml-[260px] flex-1 transition-all duration-300">
          <div className="topbar-glass sticky top-0 z-30 flex h-16 items-center justify-between px-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Workspace</p>
              <p className="font-headline text-sm font-extrabold text-[var(--color-text)]">
                {loading ? '...' : workspace?.business_name || 'My Workspace'}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)]/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white transition-all"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold"
                  style={{ backgroundColor: workspace?.brand_color || '#004a99' }}
                >
                  {initials}
                </div>
                <span className="hidden md:block max-w-[120px] truncate">
                  {workspace?.business_name || user?.email || 'Account'}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-20 w-48 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">{workspace?.business_name || 'My Workspace'}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setMenuOpen(false); router.push('/dashboard/settings'); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
