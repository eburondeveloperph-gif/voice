import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { CrmPortal } from "@/components/crm-portal";
import { findCrmProjectByHost } from "@/lib/crm/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  // For Vercel deployment, bypass CRM project check temporarily
  // TODO: Set up production database and re-enable CRM functionality
  if (process.env.NODE_ENV === 'production') {
    // Redirect to dashboard for now
    redirect("/dashboard");
  }

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  let project = null;
  
  try {
    project = await findCrmProjectByHost(host);
  } catch (error) {
    // If database fails, redirect to dashboard
    console.error('Database connection failed:', error);
  }

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
