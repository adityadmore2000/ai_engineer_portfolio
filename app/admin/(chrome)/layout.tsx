'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/admin/Sidebar';
import { CreateProjectModal } from '@/components/admin/CreateProjectModal';

export default function ChromeLayout({ children }: { children: ReactNode }) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col md:flex-row selection:bg-indigo-600 selection:text-white">
      <Sidebar onOpenNewProject={() => setIsCreateModalOpen(true)} />
      <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto">
        {children}
      </main>
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
