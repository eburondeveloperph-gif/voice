"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/client/api";
import "./bulk.css";

type Agent = { id: string; name: string };
type PhoneNumber = { id: string; displayNumber: string };

interface BulkJob {
    number: string;
    name?: string;
    assistantId?: string;
}

export default function BulkCallsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
    const [jobs, setJobs] = useState<BulkJob[]>([]);
    const [selectedAgent, setSelectedAgent] = useState("");
    const [selectedNumber, setSelectedNumber] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const [a, n] = await Promise.all([
                apiRequest<{ agents: Agent[] }>("/api/ev/voice/agents"),
                apiRequest<{ numbers: PhoneNumber[] }>("/api/ev/voice/phone-numbers")
            ]);
            setAgents(a.agents);
            setNumbers(n.numbers);
            if (a.agents.length > 0) setSelectedAgent(a.agents[0].id);
            if (n.numbers.length > 0) setSelectedNumber(n.numbers[0].id);
        }
        load();
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;

            // Basic CSV parser
            const lines = text.split("\n").filter(l => l.trim());
            const parsedJobs: BulkJob[] = lines.slice(1).map(line => {
                const [number, name, assistantId] = line.split(",").map(s => s.trim());
                return { number, name, assistantId };
            }).filter(j => j.number);

            setJobs(parsedJobs);
            setStatus(`Detected ${parsedJobs.length} calls to make.`);
        };
        reader.readAsText(file);
    };

    const startBulkCampaign = async () => {
        if (jobs.length === 0) {
            setStatus("No jobs to process.");
            return;
        }

        setIsProcessing(true);
        setStatus("Starting bulk campaign...");

        try {
            const res = await apiRequest<{ success: boolean; results: unknown[] }>("/api/ev/voice/calls/bulk", {
                method: "POST",
                body: JSON.stringify({
                    phoneNumberId: selectedNumber,
                    defaultAssistantId: selectedAgent,
                    jobs: jobs
                })
            });

            if (res.success) {
                setStatus(`Bulk campaign completed! Processed ${res.results.length} calls.`);
                setJobs([]);
            }
        } catch {
            setStatus(`Campaign error: Unknown error`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bulkPage">
            <header className="pageHead">
                <div>
                    <h1 className="pageTitle">Bulk Calls</h1>
                    <p className="pageSubtitle">Upload spreadsheets to initiate mass outbound voice campaigns.</p>
                </div>
            </header>

            <div className="card bulkCard">
                <div className="fieldGrid">
                    <label>
                        1. Select Default Agent
                        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </label>

                    <label>
                        2. Select Outbound Line
                        <select value={selectedNumber} onChange={(e) => setSelectedNumber(e.target.value)}>
                            {numbers.map(n => <option key={n.id} value={n.id}>{n.displayNumber}</option>)}
                        </select>
                    </label>

                    <label className="uploadZone">
                        3. Upload CSV File
                        <input type="file" accept=".csv" onChange={handleFileUpload} disabled={isProcessing} />
                        <div className="uploadHint">
                            Header format: <code>number, name, assistantId</code>
                        </div>
                    </label>

                    {jobs.length > 0 && (
                        <div className="previewTable tableWrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Number</th>
                                        <th>Name</th>
                                        <th>Assistant Override</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.slice(0, 5).map((j, i) => (
                                        <tr key={i}>
                                            <td>{j.number}</td>
                                            <td>{j.name || "-"}</td>
                                            <td>{j.assistantId || "Default"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {jobs.length > 5 && <p className="muted">... and {jobs.length - 5} more</p>}
                        </div>
                    )}

                    <button
                        type="button"
                        className="playBtn bulkBtn"
                        onClick={startBulkCampaign}
                        disabled={isProcessing || jobs.length === 0}
                    >
                        {isProcessing ? '⌛ Processing Bulk Jobs...' : `🚀 Start ${jobs.length} Calls`}
                    </button>

                    {status && <div className="statusBanner success">{status}</div>}
                </div>
            </div>
        </div>
    );
}
