'use client';

import type { ReactNode } from 'react';

export default function ChromeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col md:flex-row selection:bg-indigo-600 selection:text-white">
      <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
