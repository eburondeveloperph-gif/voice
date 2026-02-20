"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/client/api";

type CrmProject = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  customDomain: string | null;
  allowedEmails: string[];
  logoUrl: string | null;
  isActive: boolean;
  portalUrl: string;
  leadCount: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

type CrmProjectsResponse = {
  projects: CrmProject[];
};

export default function CrmProjectsPage() {
  const [projects, setProjects] = useState<CrmProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<CrmProjectsResponse>("/api/ev/crm/projects");
      setProjects(payload.projects);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  return (
    <div>
      <header className="pageHead">
        <div>
          <h1 className="pageTitle">Client CRM Portals</h1>
          <p className="pageSubtitle">
            CRM portals are auto-generated during user registration from company details.
          </p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="inlineActions">
          <button type="button" className="secondary" onClick={() => void loadProjects()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          New client CRM portals are automatically provisioned when users register with company details.
        </p>
        {error ? <p className="muted">{error}</p> : null}
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 12 }}>Active Portals</h3>
        {loading ? (
          <p className="muted">Loading projects...</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Portal</th>
                  <th>Custom Domain</th>
                  <th>Leads</th>
                  <th>Files</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{project.slug}</td>
                    <td>
                      <a href={project.portalUrl} target="_blank" rel="noreferrer">
                        Open Portal
                      </a>
                    </td>
                    <td>{project.customDomain ?? "-"}</td>
                    <td>{project.leadCount}</td>
                    <td>{project.fileCount}</td>
                    <td>{new Date(project.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!projects.length && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No CRM projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
