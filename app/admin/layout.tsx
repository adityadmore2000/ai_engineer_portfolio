'use client';

import { PortfolioProvider } from '@/lib/admin/context';
import './admin.css';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortfolioProvider>
      {children}
    </PortfolioProvider>
  );
}
