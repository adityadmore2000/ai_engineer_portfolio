import { HighFidelityProjectPage } from '@/components/admin/preview/HighFidelityProjectPage';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPreviewPage({ params }: PageProps) {
  const { id } = await params;
  return <HighFidelityProjectPage projectId={id} />;
}
