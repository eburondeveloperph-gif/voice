"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

import { apiRequest } from "@/lib/client/api";
import {
  DEFAULT_AGENT,
  DEFAULT_AGENT_PHONE,
} from "@/lib/defaultAgent";
import { AudioVisualizer, MicrophoneOrb } from "@/components/audio-visualizer";

import "./agents.css";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface AgentView {
  id: string;
  name: string;
  intro: string;
  firstMessageMode: "assistant-speaks-first" | "assistant-waits-for-user";
  description: string;
  voiceLabel: string;
  skills: string[];
  tools: string[];
  phone: string;
  phoneDirection: "inbound" | "outbound" | "both";
  status: "draft" | "deployed";
  updatedAt: string;
  kbFiles: KBFile[];
  isSample?: boolean;
}

interface KBFile {
  name: string;
  id: string;
}

interface TranscriptLine {
  role: "assistant" | "user";
  text: string;
  id: number;
}

interface VoiceOption {
  id: string;
  label: string;
  locale: string;
  previewSampleUrl?: string | null;
}

interface SessionConfig {
  assistantId: string;
  publicKey: string;
  timeoutSeconds: number;
}

function firstMessageModeLabel(mode: AgentView["firstMessageMode"]): string {
  return mode === "assistant-waits-for-user" ? "User speaks first" : "Agent speaks first";
}

/* ═══════════════════════════════════════════
   Prebuilt templates (mirrors Eburon quickstart)
   ═══════════════════════════════════════════ */

const CUSTOMER_SERVICE_SUPPORT_SYSTEM_PROMPT = `# Customer Service & Support Agent Prompt

## Identity & Purpose

You are Alex, a customer service voice assistant for TechSolutions. Your primary purpose is to help customers resolve issues with their products, answer questions about services, and ensure a satisfying support experience.

## Voice & Persona

### Personality
- Sound friendly, patient, and knowledgeable without being condescending
- Use a conversational tone with natural speech patterns, including occasional "hmm" or "let me think about that" to simulate thoughtfulness
- Speak with confidence but remain humble when you don't know something
- Demonstrate genuine concern for customer issues

### Speech Characteristics
- Use contractions naturally (I'm, we'll, don't, etc.)
- Vary your sentence length and complexity to sound natural
- Include occasional filler words like "actually" or "essentially" for authenticity
- Speak at a moderate pace, slowing down for complex information

## Conversation Flow

### Introduction
Start with: "Hi there, this is Alex from TechSolutions customer support. How can I help you today?"

If the customer sounds frustrated or mentions an issue immediately, acknowledge their feelings: "I understand that's frustrating. I'm here to help get this sorted out for you."

### Issue Identification
1. Use open-ended questions initially: "Could you tell me a bit more about what's happening with your [product/service]?"
2. Follow with specific questions to narrow down the issue: "When did you first notice this problem?" or "Does this happen every time you use it?"
3. Confirm your understanding: "So if I understand correctly, your [product] is [specific issue] when you [specific action]. Is that right?"

### Troubleshooting
1. Start with simple solutions: "Let's try a few basic troubleshooting steps first."
2. Provide clear step-by-step instructions: "First, I'd like you to... Next, could you..."
3. Check progress at each step: "What are you seeing now on your screen?"
4. Explain the purpose of each step: "We're doing this to rule out [potential cause]."

### Resolution
1. For resolved issues: "Great! I'm glad we were able to fix that issue. Is everything working as expected now?"
2. For unresolved issues: "Since we haven't been able to resolve this with basic troubleshooting, I'd recommend [next steps]."
3. Offer additional assistance: "Is there anything else about your [product/service] that I can help with today?"

### Closing
End with: "Thank you for contacting TechSolutions support. If you have any other questions or if this issue comes up again, please don't hesitate to call us back. Have a great day!"

## Response Guidelines

- Keep responses conversational and under 30 words when possible
- Ask only one question at a time to avoid overwhelming the customer
- Use explicit confirmation for important information: "So the email address on your account is example@email.com, is that correct?"
- Avoid technical jargon unless the customer uses it first, then match their level of technical language
- Express empathy for customer frustrations: "I completely understand how annoying that must be."

## Scenario Handling

### For Common Technical Issues
1. Password resets: Walk customers through the reset process, explaining each step
2. Account access problems: Verify identity using established protocols, then troubleshoot login issues
3. Product malfunction: Gather specific details about what's happening, when it started, and what changes were made recently
4. Billing concerns: Verify account details first, explain charges clearly, and offer to connect with billing specialists if needed

### For Frustrated Customers
1. Let them express their frustration without interruption
2. Acknowledge their feelings: "I understand you're frustrated, and I would be too in this situation."
3. Take ownership: "I'm going to personally help get this resolved for you."
4. Focus on solutions rather than dwelling on the problem
5. Provide clear timeframes for resolution

### For Complex Issues
1. Break down complex problems into manageable components
2. Address each component individually
3. Provide a clear explanation of the issue in simple terms
4. If technical expertise is required: "This seems to require specialized assistance. Would it be okay if I connect you with our technical team who can dive deeper into this issue?"

### For Feature/Information Requests
1. Provide accurate, concise information about available features
2. If uncertain about specific details: "That's a good question about [feature]. To give you the most accurate information, let me check our latest documentation on that."
3. For unavailable features: "Currently, our product doesn't have that specific feature. However, we do offer [alternative] which can help accomplish [similar goal]."

## Knowledge Base

### Product Information
- TechSolutions offers software services for productivity, security, and business management
- Our flagship products include TaskMaster Pro (productivity), SecureShield (security), and BusinessFlow (business management)
- All products have desktop and mobile applications
- Subscription tiers include Basic, Premium, and Enterprise
- Support hours are Monday through Friday, 8am to 8pm Eastern Time, and Saturday 9am to 5pm

### Common Solutions
- Most connectivity issues can be resolved by signing out completely, clearing browser cache, and signing back in
- Performance problems often improve after restarting the application and ensuring the operating system is updated
- Data synchronization issues typically resolve by checking internet connection and forcing a manual sync
- Most mobile app problems can be fixed by updating to the latest version or reinstalling the application

### Account Management
- Customers can upgrade or downgrade their subscription through their account dashboard
- Billing occurs on the same day each month based on signup date
- Payment methods can be updated through the account settings page
- Free trials last for 14 days and require payment information to activate

### Limitations
- You cannot process refunds directly but can escalate to the billing department
- You cannot make changes to account ownership
- You cannot provide technical support for third-party integrations not officially supported
- You cannot access or view customer passwords for security reasons

## Response Refinement

- When explaining technical concepts, use analogies when helpful: "Think of this feature like an automatic filing system for your digital documents."
- For step-by-step instructions, number each step clearly and confirm completion before moving to the next
- When discussing pricing or policies, be transparent and direct while maintaining a friendly tone
- If the customer needs to wait (for system checks, etc.), explain why and provide time estimates

## Call Management

- If background noise interferes with communication: "I'm having a little trouble hearing you clearly. Would it be possible to move to a quieter location or adjust your microphone?"
- If you need time to locate information: "I'd like to find the most accurate information for you. Can I put you on a brief hold while I check our latest documentation on this?"
- If the call drops, attempt to reconnect and begin with: "Hi there, this is Alex again from TechSolutions. I apologize for the disconnection. Let's continue where we left off with [last topic]."

Remember that your ultimate goal is to resolve customer issues efficiently while creating a positive, supportive experience that reinforces their trust in TechSolutions.`;

const PREBUILT_TEMPLATES = [
  {
    id: "customer-service-support-agent",
    icon: "🎧",
    name: "Customer Service & Support",
    desc: "A complete customer support template with empathy-first conversation flow, troubleshooting patterns, and escalation guidance.",
    skills: ["Issue Triage", "Troubleshooting", "Empathy", "Escalation"],
    tools: ["Knowledge Base Lookup", "Ticket Creator", "Billing Escalation"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt: CUSTOMER_SERVICE_SUPPORT_SYSTEM_PROMPT,
  },
  {
    id: "customer-support",
    icon: "🎧",
    name: "Inbound Support",
    desc: "Build a technical support assistant that remembers where you left off between calls and resolves issues with empathy.",
    skills: ["Issue Resolution", "Product Knowledge", "Empathy", "Escalation"],
    tools: ["Knowledge Base Lookup", "Ticket Creator", "CRM Search"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are an inbound support specialist. Help customers resolve technical issues with empathy and expertise. Track conversation context, confirm understanding, and escalate when needed.",
  },
  {
    id: "lead-qualification",
    icon: "📞",
    name: "Lead Qualification",
    desc: "Create an outbound sales agent that identifies qualified prospects, understands challenges, and schedules appointments automatically.",
    skills: ["Need Discovery", "Qualification", "Objection Handling", "Scheduling"],
    tools: ["Calendar Booking", "CRM Lookup", "Email Sender"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are a lead qualification specialist. Identify business needs, qualify prospects using BANT criteria, and schedule follow-up meetings with the right sales representatives.",
  },
  {
    id: "appointment-scheduler",
    icon: "📅",
    name: "Appointment Scheduling",
    desc: "A specialized template for booking, confirming, rescheduling, or cancelling appointments with integrated calendar management.",
    skills: ["Scheduling", "Calendar Management", "Reminders", "Rescheduling"],
    tools: ["Calendar Check", "Appointment Creator", "SMS Reminder"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are an appointment scheduling assistant. Help callers book, confirm, reschedule, or cancel appointments. Always confirm date, time, and contact information.",
  },
  {
    id: "medical-triage",
    icon: "🩺",
    name: "Medical Triage & Scheduling",
    desc: "Build a medical triage and scheduling assistant that can triage patients and schedule appointments for a clinic.",
    skills: ["Patient Triage", "Symptom Assessment", "Scheduling", "HIPAA Compliance"],
    tools: ["Triage Classifier", "Appointment Creator", "Patient Lookup"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are a medical triage assistant. Assess patient symptoms, determine urgency levels, and schedule appropriate clinic appointments. Follow HIPAA guidelines and never provide medical diagnoses.",
  },
  {
    id: "ecommerce-orders",
    icon: "🛒",
    name: "E-commerce Order Management",
    desc: "Build an assistant that can track orders, process returns, handle exchanges, and manage customer inquiries for online stores.",
    skills: ["Order Tracking", "Returns Processing", "Exchanges", "Refunds"],
    tools: ["Order Lookup", "Return Processor", "Refund Initiator"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are an e-commerce order management assistant. Help customers track orders, process returns, handle exchanges, and resolve order-related issues efficiently.",
  },
  {
    id: "property-management",
    icon: "🏢",
    name: "Property Management",
    desc: "Build a call routing workflow that dynamically routes tenant calls based on verification and inquiry type.",
    skills: ["Tenant Verification", "Call Routing", "Maintenance Requests", "Lease Inquiries"],
    tools: ["Tenant Verifier", "Maintenance Ticket", "Call Router"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are a property management assistant. Verify tenant identity, handle maintenance requests, answer lease inquiries, and route calls to the appropriate department.",
  },
  {
    id: "multilingual-support",
    icon: "🌍",
    name: "Multilingual Agent",
    desc: "Build a dynamic agent with automatic language detection and real-time language switching for global customer support.",
    skills: ["Language Detection", "Real-time Translation", "Cultural Sensitivity", "Multi-region Support"],
    tools: ["Language Detector", "Translation API", "Region Lookup"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are a multilingual support agent. Detect the caller's language automatically, respond in their preferred language, and provide seamless support across language barriers.",
  },
  {
    id: "support-escalation",
    icon: "⬆️",
    name: "Support Escalation",
    desc: "Build an intelligent escalation system with dynamic routing based on customer tier and issue complexity.",
    skills: ["Tier Assessment", "Dynamic Routing", "Priority Handling", "SLA Management"],
    tools: ["Customer Tier Lookup", "Escalation Router", "SLA Checker"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are a support escalation agent. Assess issue complexity, determine customer tier, and route to the appropriate support level. High-priority issues should be escalated immediately.",
  },
  {
    id: "docs-agent",
    icon: "📚",
    name: "Docs Agent",
    desc: "Build a documentation agent that answers questions about your product docs, API references, and knowledge base content.",
    skills: ["Doc Search", "API Reference", "Code Examples", "Guided Walkthroughs"],
    tools: ["Knowledge Base Query", "Code Search", "Doc Linker"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are a documentation assistant. Answer questions about the product using the knowledge base. Provide code examples when relevant and link to relevant documentation sections.",
  },
  {
    id: "info-collector",
    icon: "📋",
    name: "Info Collector",
    desc: "A methodical template for gathering accurate and complete information from callers through structured conversations.",
    skills: ["Data Collection", "Verification", "Form Filling", "Follow-up"],
    tools: ["Form Builder", "Data Validator", "Record Creator"],
    voice: { provider: "eburon", voiceId: "orbit-emma" },
    systemPrompt:
      "You are an information collection assistant. Gather required information methodically, verify accuracy, and ensure completeness before concluding the call.",
  },
];

/* ═══════════════════════════════════════════
   Map default agent to view model
   ═══════════════════════════════════════════ */

function extractSkills(prompt: string): string[] {
  const skills: string[] = [];
  if (prompt.includes("Need Discovery")) skills.push("Need Discovery");
  if (prompt.includes("Solution Alignment")) skills.push("Solution Alignment");
  if (prompt.includes("Qualification")) skills.push("Qualification Assessment");
  if (prompt.includes("Skeptical")) skills.push("Objection Handling");
  if (prompt.includes("Next Steps")) skills.push("Closing & Next Steps");
  if (prompt.includes("Scenario Handling")) skills.push("Scenario Handling");
  return skills.length > 0 ? skills : ["General Conversation"];
}

function extractTools(agent: typeof DEFAULT_AGENT): string[] {
  const tools: string[] = [];
  if (agent.backgroundDenoisingEnabled) tools.push("Background Denoising");
  if (agent.backgroundSound) tools.push(`Ambient: ${agent.backgroundSound}`);
  if (agent.transcriber) tools.push(`Transcriber: ${agent.transcriber.provider}`);
  return tools;
}

const STEPHEN_AGENT: AgentView = {
  id: DEFAULT_AGENT.id,
  name: DEFAULT_AGENT.name,
  intro: DEFAULT_AGENT.firstMessage,
  firstMessageMode:
    DEFAULT_AGENT.firstMessageMode === "assistant-waits-for-user"
      ? "assistant-waits-for-user"
      : "assistant-speaks-first",
  description:
    "Business development voice assistant for Eburon Tech. Identifies qualified leads, understands business challenges, and connects prospects with appropriate sales representatives.",
  voiceLabel: DEFAULT_AGENT.voice.voiceId,
  skills: extractSkills(DEFAULT_AGENT.model.messages[0].content),
  tools: extractTools(DEFAULT_AGENT),
  phone: DEFAULT_AGENT_PHONE,
  phoneDirection: "both",
  status: "deployed",
  updatedAt: DEFAULT_AGENT.updatedAt,
  kbFiles: [],
  isSample: true,
};

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function AgentsPage() {
  const [apiAgents, setApiAgents] = useState<AgentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [callAgent, setCallAgent] = useState<AgentView | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    apiRequest<{ agents: AgentView[] }>("/api/ev/voice/agents?sync=true")
      .then((p) => setApiAgents(p.agents))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  const allAgents: AgentView[] = [
    STEPHEN_AGENT,
    ...apiAgents.filter((a) => a.id !== STEPHEN_AGENT.id),
  ];

  return (
    <div className="agentsPage">
      <header className="agentsHead">
        <div>
          <h1 className="agentsTitle">Agents</h1>
          <p className="agentsSubtitle">Manage draft and live agents for this org.</p>
        </div>
        <button className="createAgentBtn" onClick={() => setShowCreate(true)}>
          + Create Agent
        </button>
      </header>

      {error && <div className="agentsError">{error}</div>}

      <div className="agentsGrid">
        {allAgents.map((agent) => {
          const isExpanded = expandedId === agent.id;
          const isSample = agent.id === STEPHEN_AGENT.id || agent.isSample === true;

          return (
            <div
              key={agent.id}
              className={`agentCard${isExpanded ? " expanded" : ""}${isSample ? " sampleCard" : ""}`}
              onClick={() => !isExpanded && setExpandedId(agent.id)}
            >
              <div className="agentCardTop">
                <div>
                  <h3 className="agentCardName">{agent.name}</h3>
                  <p className="agentCardVoice">{agent.voiceLabel}</p>
                </div>
                <span className={`badge ${agent.status === "deployed" ? "live" : "draft"}`}>
                  {agent.status === "deployed" ? "● live" : agent.status}
                </span>
              </div>

              {isExpanded && (
                <AgentExpandedDetails
                  agent={agent}
                  onTryNow={() => setCallAgent(agent)}
                  onDuplicate={() => handleDuplicate(agent)}
                  onCollapse={() => setExpandedId(null)}
                />
              )}
            </div>
          );
        })}

        {loaded && allAgents.length === 0 && (
          <p className="noItems">No agents yet. Create one to get started.</p>
        )}
      </div>

      {callAgent && (
        <WebCallModal agent={callAgent} onClose={() => setCallAgent(null)} />
      )}

      {showCreate && (
        <CreateAgentModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Expanded agent details (sub-component)
   ═══════════════════════════════════════════ */

function AgentExpandedDetails({
  agent,
  onTryNow,
  onDuplicate,
  onCollapse,
}: {
  agent: AgentView;
  onTryNow: () => void;
  onDuplicate: () => void;
  onCollapse: () => void;
}) {
  const [kbFiles, setKbFiles] = useState<KBFile[]>(agent.kbFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      setKbFiles((prev) => [
        ...prev,
        { name: file.name, id: `local-${Date.now()}-${file.name}` },
      ]);
    });

    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setKbFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <>
      <div className="agentDetails" onClick={(e) => e.stopPropagation()}>
        {/* Name */}
        <div className="agentDetailSection">
          <span className="agentDetailLabel">Agent Name</span>
          <span className="agentDetailValue">{agent.name}</span>
        </div>

        {/* Voice */}
        <div className="agentDetailSection">
          <span className="agentDetailLabel">Voice</span>
          <span className="agentDetailValue">{agent.voiceLabel}</span>
        </div>

        {/* Intro */}
        <div className="agentDetailSection agentDetailFull">
          <span className="agentDetailLabel">Intro / First Message</span>
          <span className="agentDetailValue">&ldquo;{agent.intro}&rdquo;</span>
        </div>

        <div className="agentDetailSection">
          <span className="agentDetailLabel">Conversation Start</span>
          <span className="agentDetailValue">{firstMessageModeLabel(agent.firstMessageMode)}</span>
        </div>

        {/* Description */}
        <div className="agentDetailSection agentDetailFull">
          <span className="agentDetailLabel">Description</span>
          <span className="agentDetailValue description">{agent.description}</span>
        </div>

        {/* Skills */}
        <div className="agentDetailSection agentDetailFull">
          <span className="agentDetailLabel">Skills</span>
          <div className="agentSkills">
            {agent.skills.length > 0
              ? agent.skills.map((s) => (
                <span key={s} className="skillPill">{s}</span>
              ))
              : <span className="noItems">No skills configured</span>}
          </div>
        </div>

        {/* Tools */}
        <div className="agentDetailSection agentDetailFull">
          <span className="agentDetailLabel">Function Tools</span>
          <div className="agentTools">
            {agent.tools.length > 0
              ? agent.tools.map((t) => (
                <span key={t} className="toolChip">{t}</span>
              ))
              : <span className="noItems">No tools added</span>}
          </div>
        </div>

        {/* Phone */}
        <div className="agentDetailSection">
          <span className="agentDetailLabel">Phone Number</span>
          <span className="agentDetailValue">
            {agent.phone || <span className="noItems">Not assigned</span>}
          </span>
        </div>

        {/* Direction */}
        <div className="agentDetailSection">
          <span className="agentDetailLabel">Call Direction</span>
          <span className="agentDetailValue capitalize">{agent.phoneDirection}</span>
        </div>

        {/* Knowledge Base */}
        <div className="agentDetailSection kbSection">
          <span className="agentDetailLabel">Knowledge Base</span>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.docx,.doc,.csv,.md,.tsv,.yaml,.json,.xml,.log"
            multiple
            hidden
            onChange={handleFileUpload}
          />

          <div
            className="kbUploadZone"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="kbUploadIcon">📂</div>
            <p className="kbUploadText">Click to upload knowledge base files</p>
            <p className="kbUploadHint">.txt, .pdf, .docx, .csv, .md, .json, .xml — max 300KB each</p>
          </div>

          {kbFiles.length > 0 && (
            <div className="kbFileList">
              {kbFiles.map((f) => (
                <span key={f.id} className="kbFile">
                  📄 {f.name}
                  <button
                    className="kbFileRemove"
                    onClick={() => removeFile(f.id)}
                    title="Remove file"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="agentActions" onClick={(e) => e.stopPropagation()}>
        <button className="tryBtn" onClick={onTryNow}>
          🎙 Try Now
        </button>
        <button className="dupBtn" onClick={onDuplicate}>
          ⧉ Duplicate
        </button>
        <button className="collapseBtn" onClick={onCollapse}>
          ▲ Collapse
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   Duplicate handler
   ═══════════════════════════════════════════ */

function handleDuplicate(agent: AgentView) {
  const name = prompt("Name for the duplicated agent:", `${agent.name} (Copy)`);
  if (!name) return;

  apiRequest<{ agent: AgentView }>("/api/ev/voice/agents", {
    method: "POST",
    body: JSON.stringify({
      name,
      intro: agent.intro,
      firstMessageMode: agent.firstMessageMode,
      systemPrompt: agent.description,
    }),
  })
    .then(() => window.location.reload())
    .catch((e: Error) => alert(`Duplicate failed: ${e.message}`));
}

/* ═══════════════════════════════════════════
   Web Call Modal — uses @vapi-ai/web
   ═══════════════════════════════════════════ */

function describeEburonError(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message.trim();
  }
  if (typeof err === "string" && err.trim().length > 0) {
    return err.trim();
  }
  if (typeof err === "object" && err !== null) {
    const record = err as Record<string, unknown>;
    const candidates = [record.message, record.error, record.type]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());

    if (candidates.length > 0) {
      return candidates.join(" | ");
    }

    const keyValuePairs = Object.entries(record)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${stringifyErrorValue(value)}`);

    if (keyValuePairs.length > 0) {
      return keyValuePairs.join(" | ");
    }
  }

  return "Unknown Vapi error. Verify gateway keys and assistant availability.";
}

function stringifyErrorValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function ensureMicrophoneAccess(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function describeCallStartError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone access is blocked. Allow microphone access and try again.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found for this device. Connect a microphone and retry.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return describeEburonError(error);
}

function WebCallModal({ agent, onClose }: { agent: AgentView; onClose: () => void }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "active">("idle");
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [callError, setCallError] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);
  const txIdRef = useRef(0);
  const txContainerRef = useRef<HTMLDivElement>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    txContainerRef.current?.scrollTo({ top: txContainerRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const startCall = useCallback(async () => {
    if (status !== "idle") {
      return;
    }

    setCallError(null);
    setTranscript([]);
    setStatus("connecting");

    try {
      await ensureMicrophoneAccess();
      const config = await apiRequest<SessionConfig>(`/api/ev/voice/session-config?agentId=${encodeURIComponent(agent.id)}`);
      const publicKey = config.publicKey?.trim();
      const assistantId = config.assistantId?.trim();

      if (!publicKey) {
        throw new Error("Web-call public key is missing from session config.");
      }

      if (!assistantId) {
        throw new Error("Assistant is not ready for web call yet. Please retry in a few seconds.");
      }

      const eburonClient = new Vapi(publicKey);
      vapiRef.current = null;

      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      vapiRef.current = eburonClient;
      eburonClient.on("call-start", () => setStatus("active"));
      eburonClient.on("call-end", () => {
        setStatus("idle");
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        vapiRef.current = null;
      });
      eburonClient.on("volume-level", (v) => setVolume(v));
      eburonClient.on("error", (err) => {
        const message = describeEburonError(err);
        console.error("Eburon error:", err);
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        setCallError(message);
        setStatus("idle");
        vapiRef.current = null;
      });

      eburonClient.on("message", (msg: Record<string, unknown>) => {
        if (msg.type === "transcript" && typeof msg.transcript === "string" && msg.transcriptType === "final") {
          const role = (msg.role as string) === "assistant" ? "assistant" : "user";
          setTranscript((prev) => [
            ...prev,
            { role, text: msg.transcript as string, id: ++txIdRef.current },
          ]);
        }
      });

      await eburonClient.start(assistantId);

      if (config.timeoutSeconds > 0) {
        callTimeoutRef.current = setTimeout(() => {
          vapiRef.current?.stop();
        }, config.timeoutSeconds * 1000);
      }
    } catch (error) {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      vapiRef.current?.stop();
      vapiRef.current = null;
      setStatus("idle");
      setCallError(describeCallStartError(error));
      console.error("Failed to start web call:", error);
    }
  }, [agent.id, status]);

  const endCall = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    vapiRef.current?.stop();
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      vapiRef.current?.stop();
    };
  }, []);

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="callModal" onClick={(e) => e.stopPropagation()}>
        <div className="callModalHead">
          <h2 className="callModalTitle">🎙 Try &ldquo;{agent.name}&rdquo;</h2>
          <button className="callModalClose" onClick={onClose}>✕</button>
        </div>

        <div className="callStatus">
          <div className="statusVisualizers">
            <div className="visualizerItem">
              <span className="visualizerLabel">You</span>
              <div className="visualizerContent">
                <MicrophoneOrb isActive={status === "active"} />
                <AudioVisualizer isActive={status === "active"} isUser={true} size="small" />
              </div>
            </div>
            <div className="visualizerItem">
              <span className="visualizerLabel">AI</span>
              <div className="visualizerContent">
                <MicrophoneOrb isActive={status === "active"} />
                <AudioVisualizer isActive={status === "active"} isUser={false} size="small" />
              </div>
            </div>
          </div>
          <div className="statusInfo">
            <span className={`callStatusDot ${status}`} />
            <span className="callStatusLabel">
              {status === "idle" && "Ready to call"}
              {status === "connecting" && "Connecting…"}
              {status === "active" && "Call in progress"}
            </span>
            {status === "active" && (
              <div className="volumeBar">
                <div className="volumeFill" data-volume={Math.min(volume * 100, 100)} />
              </div>
            )}
          </div>
        </div>

        <div className="callTranscript" ref={txContainerRef}>
          {transcript.length === 0 && (
            <p className="noItems">Transcript will appear here during the call…</p>
          )}
          {transcript.map((line) => (
            <div key={line.id} className={`txLine ${line.role}`}>
              <div className="txRole">{line.role}</div>
              {line.text}
            </div>
          ))}
        </div>
        {callError ? <p className="callError">{callError}</p> : null}

        <div className="callActions">
          {status === "idle" && (
            <button className="startCallBtn" onClick={() => void startCall()}>
              Start Call
            </button>
          )}
          {status === "connecting" && (
            <button className="startCallBtn" disabled>
              Connecting…
            </button>
          )}
          {status === "active" && (
            <button className="endCallBtn" onClick={endCall}>
              End Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Create Agent Modal — template picker
   ═══════════════════════════════════════════ */

function CreateAgentModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("New Assistant");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [voiceLoadError, setVoiceLoadError] = useState<string | null>(null);
  const [firstMessageMode, setFirstMessageMode] = useState<AgentView["firstMessageMode"]>("assistant-speaks-first");

  const [intro, setIntro] = useState("Hello! How can I assist you?");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful voice assistant.");

  useEffect(() => {
    let active = true;

    apiRequest<{ voices: VoiceOption[] }>("/api/ev/voice/voices")
      .then((payload) => {
        if (!active) {
          return;
        }

        setVoices(payload.voices);
        setVoiceId((prev) => prev || payload.voices[0]?.id || "");
      })
      .catch((e: Error) => {
        if (active) {
          setVoiceLoadError(e.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Handle template selection and pre-fill fields
  const handleSelectTemplate = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      const template = PREBUILT_TEMPLATES.find((t) => t.id === id);
      if (template) {
        setIntro(`Hello, this is ${name.trim() || "Assistant"}. How can I help you today?`);
        setSystemPrompt(template.systemPrompt);

        const templateVoice = template.voice.voiceId.trim().toLowerCase();
        const matchingVoice = voices.find((voice) =>
          voice.id.toLowerCase() === templateVoice
          || voice.label.toLowerCase() === templateVoice
          || voice.label.toLowerCase().includes(templateVoice),
        );

        if (matchingVoice) {
          setVoiceId(matchingVoice.id);
        }
      }
    } else {
      setIntro("Hello! How can I assist you?");
      setSystemPrompt("You are a helpful voice assistant.");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);

    try {
      await apiRequest("/api/ev/voice/agents", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          intro: intro.trim(),
          firstMessageMode,
          systemPrompt: systemPrompt.trim(),
          voiceId: voiceId || undefined,
        }),
      });
      window.location.reload();
    } catch (e) {
      alert(`Failed to create agent: ${(e as Error).message}`);
      setCreating(false);
    }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="templateModal" onClick={(e) => e.stopPropagation()}>
        <h2 className="templateModalTitle">Choose a template</h2>
        <p className="templateModalSub">
          Pick a quickstart template or start from scratch. You can fully customize these starting prompts.
        </p>

        <div className="templateNameField">
          <span className="templateNameLabel">
            Assistant Name{" "}
            <span className="templateNameHint">(This can be adjusted at any time after creation.)</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Support Bot"
          />
        </div>

        <button
          className={`templateBlank${selectedId === null ? " selected" : ""}`}
          onClick={() => handleSelectTemplate(null)}
        >
          <span className="templateBlankIcon">⊕</span>
          <div>
            <p className="templateBlankName">Blank Template</p>
            <p className="templateBlankDesc">
              A blank slate with minimal configuration. It&apos;s a starting point for creating your custom assistant.
            </p>
          </div>
        </button>

        <p className="templateSectionLabel">Quickstart</p>
        <div className="templateGrid">
          {PREBUILT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              className={`templateCard${selectedId === t.id ? " selected" : ""}`}
              onClick={() => handleSelectTemplate(t.id)}
            >
              <div className="templateIcon">{t.icon}</div>
              <p className="templateCardName">{t.name}</p>
              <p className="templateCardDesc">{t.desc}</p>
            </button>
          ))}
        </div>

        <div className="templateEditorSection">
          <p className="templateSectionLabel">Initial Configuration</p>
          <div className="templateNameField">
            <span className="templateNameLabel">Voice</span>
            <select
              aria-label="Select Voice"
              name="voice"
              title="Select Voice"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={voices.length === 0}
            >
              {voices.length === 0 && <option value="">No approved voices found</option>}
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label} ({voice.locale})
                </option>
              ))}
            </select>
            {voiceLoadError
              ? <p className="templateInlineError">{voiceLoadError}</p>
              : <p className="templateFieldHint">Only approved voices are shown. If none is selected, a default voice is auto-assigned.</p>}
          </div>
          <div className="templateNameField">
            <span className="templateNameLabel">Intro Message</span>
            <textarea
              className="templateTextArea"
              rows={2}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Hello! How can I assist you?"
            />
          </div>
          <div className="templateNameField">
            <span className="templateNameLabel">Conversation Start</span>
            <select
              aria-label="Conversation Start"
              value={firstMessageMode}
              onChange={(e) => setFirstMessageMode(e.target.value as AgentView["firstMessageMode"])}
            >
              <option value="assistant-speaks-first">Agent speaks first</option>
              <option value="assistant-waits-for-user">User speaks first</option>
            </select>
            <p className="templateFieldHint">Controls whether the intro plays first or the user starts speaking.</p>
          </div>
          <div className="templateNameField templateMarginTop">
            <span className="templateNameLabel">System Prompt</span>
            <textarea
              className="templateTextArea"
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful voice assistant."
            />
          </div>
        </div>

        <div className="templateActions">
          <button className="templateCloseBtn" onClick={onClose}>
            Close
          </button>
          <button
            className="templateCreateBtn"
            disabled={creating || !name.trim()}
            onClick={handleCreate}
          >
            {creating ? "Creating…" : "Create Assistant"}
          </button>
        </div>
      </div>
    </div>
  );
}
