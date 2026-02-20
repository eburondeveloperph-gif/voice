import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { CrmPortal } from "@/components/crm-portal";
import { findCrmProjectByHost } from "@/lib/crm/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const project = await findCrmProjectByHost(host);

  if (project) {
    return (
      <CrmPortal
        clientSlug={project.slug}
        projectName={project.name}
        projectDescription={project.description}
        logoUrl={project.logoUrl}
      />
    );
  }

  redirect("/dashboard");
}
