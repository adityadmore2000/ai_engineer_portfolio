import type { ReactNode } from 'react';
import '../admin.css';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      {children}
    </div>
  );
}
