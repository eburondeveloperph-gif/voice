"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

type EmbedRequest = {
    id: string;
    name: string;
    slug: string;
    embedStatus: "requested" | "approved" | "disabled";
    customDomain: string | null;
    createdAt: string;
    org: { name: string };
};

export default function AdminEmbedRequestsPage() {
    const [requests, setRequests] = useState<EmbedRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadRequests() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/embed-requests");
            if (!res.ok) throw new Error("Failed to load requests");
            const data = await res.json();
            setRequests(data.requests || []);
        } catch (e: unknown) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError(String(e));
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadRequests();
    }, []);

    async function updateStatus(projectId: string, newStatus: string) {
        try {
            const res = await fetch("/api/admin/embed-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, status: newStatus }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            await loadRequests();
        } catch (e: unknown) {
            if (e instanceof Error) {
                alert("Error: " + e.message);
            } else {
                alert("Error: " + String(e));
            }
        }
    }

    return (
        <div className="adminContainer">
            <header className="pageHead adminHeader">
                <div>
                    <h1 className="pageTitle">Embed Approvals</h1>
                    <p className="pageSubtitle">Review and approve client requests to iframe their CRM dashboards.</p>
                </div>
                <button type="button" className="secondary" onClick={() => void loadRequests()} disabled={loading}>
                    {loading ? "Refreshing..." : "Refresh List"}
                </button>
            </header>

            {error && <p className="adminError">{error}</p>}

            <section className="adminSection">
                {requests.length === 0 && !loading ? (
                    <div className="card adminEmptyCard">
                        <p className="muted">No pending embed requests found.</p>
                    </div>
                ) : (
                    <div className="tableWrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Client Organization</th>
                                    <th>Project Details</th>
                                    <th>Status</th>
                                    <th>Requested</th>
                                    <th className="adminActionsHead">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((req) => (
                                    <tr key={req.id}>
                                        <td className="adminOrgName">{req.org.name}</td>
                                        <td>
                                            <div>{req.name}</div>
                                            <div className="muted adminProjectSlug">
                                                /{req.slug} {req.customDomain ? `• ${req.customDomain}` : ""}
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className={`adminStatusBadge ${req.embedStatus === "approved" ? "adminStatusApproved" : "adminStatusRequested"}`}
                                            >
                                                {req.embedStatus.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="muted">{formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</td>
                                        <td className="adminActionsCell">
                                            <div className="inlineActions adminActionsRow">
                                                {req.embedStatus === "requested" ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="adminBtnSmall"
                                                            onClick={() => void updateStatus(req.id, "approved")}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="secondary adminBtnSmall adminBtnDeny"
                                                            onClick={() => void updateStatus(req.id, "disabled")}
                                                        >
                                                            Deny
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="secondary adminBtnSmall"
                                                        onClick={() => void updateStatus(req.id, "disabled")}
                                                    >
                                                        Revoke Access
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
