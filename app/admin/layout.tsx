'use client';

import { PortfolioProvider } from '@/lib/admin/context';
import { Toast } from '@/components/admin/common/Toast';
import './admin.css';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortfolioProvider>
      {children}
      <Toast />
    </PortfolioProvider>
  );
}
