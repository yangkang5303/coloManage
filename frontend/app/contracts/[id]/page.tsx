import { ResourcePage } from "@/components/resource-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResourcePage title="Contract Detail" endpoint={`/contracts/${id}`} />;
}