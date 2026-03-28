export const APP_NAME = 'Physical Therapy 365';
export const APP_DESCRIPTION = 'Invoice & Payment Management';
export const VENMO_HANDLE = 'jakethomas06';
export const ZELLE_PHONE = '945-209-1854';
export const BUSINESS_EMAIL = 'jakethomasdpt@gmail.com';
export const DOMAIN = 'physicaltherapy365.com';

export const BRAND_COLORS = {
  primary: '#2563EB', // Blue-600
  primaryDark: '#1D4ED8', // Blue-700
  secondary: '#0F172A', // Slate-900 (near black)
  accent: '#3B82F6', // Blue-500
  background: '#FFFFFF',
  backgroundDark: '#0F172A',
  surfaceDark: '#1E293B',
  text: '#0F172A',
  textDark: '#F8FAFC',
  border: '#E2E8F0',
  borderDark: '#334155',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export const INVOICE_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
  sent: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  viewed: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  paid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  overdue: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' },
};
