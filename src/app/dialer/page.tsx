"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import "./dialer.css";

type Agent = {
    id: string;
    name: string;
};

type PhoneNumber = {
    id: string;
    displayNumber: string;
};

export default function DialerPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
    const [loading, setLoading] = useState(true);

    const [targetNumber, setTargetNumber] = useState("");
    const [selectedAgent, setSelectedAgent] = useState("");
    const [selectedNumber, setSelectedNumber] = useState("");
    const [isCalling, setIsCalling] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const [agentsRes, numbersRes] = await Promise.all([
                    apiRequest<{ agents: Agent[] }>("/api/ev/voice/agents"),
                    apiRequest<{ numbers: PhoneNumber[] }>("/api/ev/voice/phone-numbers")
                ]);
                setAgents(agentsRes.agents);
                setNumbers(numbersRes.numbers);
                if (agentsRes.agents.length > 0) setSelectedAgent(agentsRes.agents[0].id);
                if (numbersRes.numbers.length > 0) setSelectedNumber(numbersRes.numbers[0].id);
            } catch {
                setStatus("Error loading configuration data.");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const handleStartCall = async () => {
        if (!targetNumber || !selectedAgent || !selectedNumber) {
            setStatus("Please fill in all fields.");
            return;
        }

        setIsCalling(true);
        setStatus("Initiating outbound call...");

        try {
            const res = await apiRequest<{ success: boolean; callId: string }>("/api/ev/voice/calls/outbound", {
                method: "POST",
                body: JSON.stringify({
                    assistantId: selectedAgent,
                    phoneNumberId: selectedNumber,
                    customerNumber: targetNumber
                })
            });

            if (res.success) {
                setStatus(`Call successfully initiated! ID: ${res.callId}`);
                setTargetNumber("");
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Call failed: ${message}`);
        } finally {
            setIsCalling(false);
        }
    };

    if (loading) return <div className="dialerPage"><p className="muted">Loading dialer...</p></div>;

    return (
        <div className="dialerPage">
            <header className="pageHead">
                <div>
                    <h1 className="pageTitle">Outbound Dialer</h1>
                    <p className="pageSubtitle">Manually initiate phone calls with your voice agents.</p>
                </div>
            </header>

            <div className="dialerCard card">
                <div className="fieldGrid">
                    <label>
                        Destination Number
                        <input
                            type="tel"
                            placeholder="+14150000000"
                            value={targetNumber}
                            onChange={(e) => setTargetNumber(e.target.value)}
                            disabled={isCalling}
                        />
                    </label>

                    <label>
                        Select Agent
                        <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            disabled={isCalling}
                        >
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </label>

                    <label>
                        From Number
                        <select
                            value={selectedNumber}
                            onChange={(e) => setSelectedNumber(e.target.value)}
                            disabled={isCalling}
                        >
                            {numbers.map(n => <option key={n.id} value={n.id}>{n.displayNumber}</option>)}
                        </select>
                    </label>

                    <button
                        type="button"
                        className="playBtn dialerBtn"
                        onClick={handleStartCall}
                        disabled={isCalling || numbers.length === 0}
                    >
                        {isCalling ? '⌛ Dialing...' : '📞 Start Call Now'}
                    </button>

                    {status && (
                        <div className={`statusBanner ${status.includes('failed') || status.includes('Error') ? 'error' : 'success'}`}>
                            {status}
                        </div>
                    )}
                </div>
            </div>

            {numbers.length === 0 && (
                <div className="warningBox">
                    <p>⚠️ No phone numbers available. Please purchase a number in the Numbers tab first.</p>
                </div>
            )}
        </div>
    );
}
