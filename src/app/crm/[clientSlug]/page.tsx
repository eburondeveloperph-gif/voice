import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ clientSlug: string }>;
};

export const dynamic = "force-dynamic";

export default async function LegacyClientProjectPage({ params }: PageProps) {
  const { clientSlug } = await params;
  redirect(`/portal/${encodeURIComponent(clientSlug)}`);
}
