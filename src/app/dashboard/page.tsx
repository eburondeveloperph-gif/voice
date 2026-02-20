"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/client/api";

type OverviewResponse = {
  org: { name: string };
  metrics: {
    agentsCount: number;
    liveAgentsCount: number;
    callsCount: number;
    contactsCount: number;
    numberCount: number;
    balanceCents: number;
  };
};

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<OverviewResponse>("/api/ev/dashboard/overview")
      .then(setOverview)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div>
      <header className="pageHead">
        <div>
          <h1 className="pageTitle">Dashboard</h1>
          <p className="pageSubtitle">Overview of live usage and account health.</p>
        </div>
      </header>

      {error && <div className="card">{error}</div>}

      <section className="sectionGrid">
        <article className="card metricCard">
          <p className="kicker">Org</p>
          <p className="metricValue">{overview?.org.name ?? "..."}</p>
        </article>
        <article className="card metricCard">
          <p className="kicker">Agents</p>
          <p className="metricValue">{overview?.metrics.agentsCount ?? 0}</p>
        </article>
        <article className="card metricCard">
          <p className="kicker">Live Agents</p>
          <p className="metricValue">{overview?.metrics.liveAgentsCount ?? 0}</p>
        </article>
        <article className="card metricCard">
          <p className="kicker">Calls Logged</p>
          <p className="metricValue">{overview?.metrics.callsCount ?? 0}</p>
        </article>
        <article className="card metricCard">
          <p className="kicker">Contacts</p>
          <p className="metricValue">{overview?.metrics.contactsCount ?? 0}</p>
        </article>
        <article className="card metricCard">
          <p className="kicker">Active Numbers</p>
          <p className="metricValue">{overview?.metrics.numberCount ?? 0}</p>
        </article>
        <article className="card metricCard">
          <p className="kicker">Billing Balance</p>
          <p className="metricValue">${((overview?.metrics.balanceCents ?? 0) / 100).toFixed(2)}</p>
        </article>
      </section>
    </div>
  );
}
