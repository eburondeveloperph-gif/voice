"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/client/api";

type CallItem = {
  id: string;
  vapiCallId: string;
  status: string;
  fromNumber: string | null;
  toNumber: string | null;
  durationSeconds: number | null;
  costUsd: number | null;
  startedAt: string | null;
  agent: { id: string; name: string } | null;
};

export default function CallLogsPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(sync = false) {
    setLoading(true);
    try {
      const payload = await apiRequest<{ calls: CallItem[] }>(
        `/api/ev/voice/calls?sync=${sync}&q=${encodeURIComponent(query)}`,
      );
      setCalls(payload.calls);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiRequest<{ calls: CallItem[] }>(`/api/ev/voice/calls?sync=false&q=${encodeURIComponent("")}`)
      .then((payload) => {
        if (active) {
          setCalls(payload.calls);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <header className="pageHead">
        <div>
          <h1 className="pageTitle">Call Logs</h1>
          <p className="pageSubtitle">Search and inspect call outcomes.</p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="inlineActions">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search number or call id"
            style={{ maxWidth: 320 }}
          />
          <button type="button" className="secondary" onClick={() => void load(false)} disabled={loading}>
            Search
          </button>
          <button type="button" onClick={() => void load(true)} disabled={loading}>
            Sync Now
          </button>
        </div>
      </section>

      <section className="card">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Call</th>
                <th>Agent</th>
                <th>Status</th>
                <th>From</th>
                <th>To</th>
                <th>Duration</th>
                <th>Cost</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id}>
                  <td>{call.vapiCallId}</td>
                  <td>{call.agent?.name ?? "-"}</td>
                  <td>{call.status}</td>
                  <td>{call.fromNumber ?? "-"}</td>
                  <td>{call.toNumber ?? "-"}</td>
                  <td>{call.durationSeconds ?? "-"}</td>
                  <td>{typeof call.costUsd === "number" ? `$${call.costUsd.toFixed(3)}` : "-"}</td>
                  <td>{call.startedAt ? new Date(call.startedAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    No calls logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
