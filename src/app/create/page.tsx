import { AgentBuilder } from "@/components/agent-builder";

export default function CreatePage() {
  return (
    <div>
      <header className="pageHead">
        <div>
          <h1 className="pageTitle">Create</h1>
          <p className="pageSubtitle">Draft → Validate → Preview → Deploy</p>
        </div>
      </header>

      <AgentBuilder />
    </div>
  );
}
