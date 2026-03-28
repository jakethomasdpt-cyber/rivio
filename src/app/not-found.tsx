'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
        <p className="text-slate-600 mb-8">Page not found</p>
        <Link href="/" className="text-blue-600 hover:underline">
          Go home
        </Link>
      </div>
    </div>
  );
}
