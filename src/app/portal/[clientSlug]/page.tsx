import { notFound } from "next/navigation";

import { CrmPortal } from "@/components/crm-portal";
import { findCrmProjectBySlug } from "@/lib/crm/projects";

type PageProps = {
  params: Promise<{ clientSlug: string }>;
};

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({ params }: PageProps) {
  const { clientSlug } = await params;
  const project = await findCrmProjectBySlug(clientSlug);

  if (!project || !project.isActive) {
    notFound();
  }

  return (
    <CrmPortal
      clientSlug={project.slug}
      projectName={project.name}
      projectDescription={project.description}
      logoUrl={project.logoUrl}
    />
  );
}
