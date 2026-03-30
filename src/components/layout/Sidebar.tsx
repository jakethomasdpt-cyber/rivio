'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FileText, Landmark, Settings, Sun, Moon, ChevronLeft, ChevronRight, Zap, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeContext } from './ThemeProvider';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Clients', icon: Users, href: '/dashboard/clients' },
  { label: 'Invoices', icon: FileText, href: '/dashboard/invoices' },
  { label: 'Finance', icon: Landmark, href: '/dashboard/finance' },
  { label: 'Mileage', icon: Car, href: '/dashboard/mileage' },
  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

interface SidebarProps {
  workspace?: {
    business_name: string;
    brand_color?: string | null;
  } | null;
}

export default function Sidebar({ workspace }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme, mounted } = useThemeContext();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 flex h-screen flex-col overflow-y-auto border-r border-white/10 bg-[var(--color-sidebar)] shadow-2xl transition-all duration-300',
      collapsed ? 'w-[72px]' : 'w-[260px]'
    )}>
      <div className="mb-8 border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#00346f] to-[#004a99]">
            <Zap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-headline text-base font-extrabold tracking-tight text-white">Rivio</h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{workspace?.business_name || 'Your Workspace'}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 border-r-4 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] transition-all duration-200',
                isActive
                  ? 'border-white bg-[#004a99] text-white'
                  : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-white')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 px-3 pb-4">
        {mounted && (
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 flex-shrink-0" /> : <Moon className="h-5 w-5 flex-shrink-0" />}
            {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-5 w-5 flex-shrink-0" /> : <ChevronLeft className="h-5 w-5 flex-shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
