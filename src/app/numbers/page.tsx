"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/client/api";

type NumberItem = {
  id: string;
  displayNumber: string;
  status: string;
  monthlyPriceCents: number;
  assignedAgent: { id: string; name: string } | null;
};

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(sync = false) {
    setLoading(true);
    try {
      const payload = await apiRequest<{ numbers: NumberItem[] }>(`/api/ev/voice/phone-numbers?sync=${sync}`);
      setNumbers(payload.numbers);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiRequest<{ numbers: NumberItem[] }>(`/api/ev/voice/phone-numbers?sync=false`)
      .then((payload) => {
        if (active) {
          setNumbers(payload.numbers);
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

  async function purchase() {
    await apiRequest<{ number: NumberItem }>("/api/ev/voice/phone-numbers", {
      method: "POST",
      body: JSON.stringify({
        country: "US",
      }),
    });
    await load(false);
  }

  return (
    <div>
      <header className="pageHead">
        <div>
          <h1 className="pageTitle">Numbers</h1>
          <p className="pageSubtitle">Purchase and assign org-owned numbers. Flat $15/month each.</p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="inlineActions">
          <button type="button" onClick={() => void purchase()} disabled={loading}>
            Purchase Number
          </button>
          <button type="button" className="secondary" onClick={() => void load(true)} disabled={loading}>
            Sync Inventory
          </button>
        </div>
      </section>

      <section className="card">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Status</th>
                <th>Assigned Agent</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((num) => (
                <tr key={num.id}>
                  <td>{num.displayNumber}</td>
                  <td>{num.status}</td>
                  <td>{num.assignedAgent?.name ?? "-"}</td>
                  <td>${(num.monthlyPriceCents / 100).toFixed(2)}</td>
                </tr>
              ))}
              {numbers.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No numbers yet.
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
