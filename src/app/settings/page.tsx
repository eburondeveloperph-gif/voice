"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/client/api";

type SettingsStatus = {
  org: {
    id: string;
    name: string;
    slug: string;
  };
  gateway: {
    privateTokenConfigured: boolean;
    publicWebKeyConfigured: boolean;
    allowedOrigins: string[];
    lastAuditAt: string | null;
  };
  operations: {
    lastCallAt: string | null;
    previewTimeoutSeconds: number;
    userRateLimitPerMinute: number;
    orgRateLimitPerMinute: number;
  };
};

type IntegrationFieldOption = {
  value: string;
  label: string;
};

type IntegrationField = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "boolean" | "json" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: IntegrationFieldOption[];
  defaultValue?: string | number | boolean;
};

type ProviderCatalogItem = {
  key: string;
  label: string;
  badge: string;
  category: string;
  categoryLabel: string;
  description: string;
  mode: "vapi_credential" | "local_config";
  deprecated: boolean;
  vapiProvider?: string;
  fields: IntegrationField[];
};

type ProviderCategory = {
  key: string;
  label: string;
  providers: ProviderCatalogItem[];
};

type ProvidersResponse = {
  categories: ProviderCategory[];
};

type IntegrationItem = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  providerKey: string;
  providerLabel: string;
  providerBadge: string;
  description: string;
  mode: "vapi_credential" | "local_config";
  vapiProvider: string | null;
  upstreamCredentialId: string | null;
  status: "active" | "disabled";
  deprecated: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type IntegrationListResponse = {
  integrations: IntegrationItem[];
};

type FormState = Record<string, string | boolean>;

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [providerCategories, setProviderCategories] = useState<ProviderCategory[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [busyIntegrationId, setBusyIntegrationId] = useState<string | null>(null);

  const allProviders = useMemo(
    () => providerCategories.flatMap((category) => category.providers),
    [providerCategories],
  );

  const [selectedProviderKey, setSelectedProviderKey] = useState<string>("");
  const selectedProvider = useMemo(
    () => allProviders.find((provider) => provider.key === selectedProviderKey) ?? null,
    [allProviders, selectedProviderKey],
  );

  const [integrationName, setIntegrationName] = useState<string>("");
  const [createStatus, setCreateStatus] = useState<"active" | "disabled">("active");
  const [formValues, setFormValues] = useState<FormState>({});

  async function loadStatus() {
    return apiRequest<SettingsStatus>("/api/ev/settings/status");
  }

  async function loadProviders() {
    return apiRequest<ProvidersResponse>("/api/ev/settings/integrations/providers");
  }

  async function loadIntegrations() {
    return apiRequest<IntegrationListResponse>("/api/ev/settings/integrations");
  }

  function resetFormForProvider(provider: ProviderCatalogItem) {
    setSelectedProviderKey(provider.key);
    setIntegrationName(provider.label);
    setCreateStatus("active");
    setFormValues(buildInitialFormState(provider));
  }

  useEffect(() => {
    let mounted = true;

    Promise.all([loadStatus(), loadProviders(), loadIntegrations()])
      .then(([statusPayload, providerPayload, integrationPayload]) => {
        if (!mounted) {
          return;
        }

        setStatus(statusPayload);
        setProviderCategories(providerPayload.categories);
        setIntegrations(integrationPayload.integrations);

        const firstProvider = providerPayload.categories[0]?.providers[0];
        if (firstProvider) {
          resetFormForProvider(firstProvider);
        }
      })
      .catch((loadError) => {
        if (mounted) {
          setError((loadError as Error).message);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  function updateFieldValue(field: IntegrationField, value: string | boolean) {
    setFormValues((prev) => ({
      ...prev,
      [field.key]: value,
    }));
  }

  async function refreshIntegrations() {
    const payload = await loadIntegrations();
    setIntegrations(payload.integrations);
  }

  async function createIntegration() {
    if (!selectedProvider) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        providerKey: selectedProvider.key,
        name: integrationName.trim() || selectedProvider.label,
        status: createStatus,
        config: formValues,
      };

      await apiRequest<{ integration: IntegrationItem }>("/api/ev/settings/integrations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await refreshIntegrations();
      resetFormForProvider(selectedProvider);
      setMessage(`${selectedProvider.label} integration created.`);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleIntegrationStatus(item: IntegrationItem) {
    const nextStatus = item.status === "active" ? "disabled" : "active";
    setBusyIntegrationId(item.id);
    setError("");
    setMessage("");

    try {
      await apiRequest<{ integration: IntegrationItem }>(`/api/ev/settings/integrations/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await refreshIntegrations();
      setMessage(`${item.name} is now ${nextStatus}.`);
    } catch (toggleError) {
      setError((toggleError as Error).message);
    } finally {
      setBusyIntegrationId(null);
    }
  }

  async function deleteIntegration(item: IntegrationItem) {
    const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setBusyIntegrationId(item.id);
    setError("");
    setMessage("");

    try {
      await apiRequest<{ ok: true }>(`/api/ev/settings/integrations/${item.id}`, {
        method: "DELETE",
      });
      await refreshIntegrations();
      setMessage(`${item.name} deleted.`);
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setBusyIntegrationId(null);
    }
  }

  if (loading) {
    return (
      <div>
        <header className="pageHead">
          <div>
            <h1 className="pageTitle">Settings</h1>
            <p className="pageSubtitle">Loading workspace settings...</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div>
      <header className="pageHead">
        <div>
          <h1 className="pageTitle">Settings</h1>
          <p className="pageSubtitle">Gateway controls, limits, and provider integrations.</p>
        </div>
      </header>

      <section className="sectionGrid" style={{ marginBottom: 14 }}>
        <article className="card metricCard">
          <p className="kicker">Organization</p>
          <div>
            <p style={{ margin: "8px 0 2px", fontWeight: 700 }}>{status?.org.name}</p>
            <p className="muted" style={{ margin: 0 }}>{status?.org.slug}</p>
          </div>
        </article>
        <article className="card metricCard">
          <p className="kicker">Gateway</p>
          <div>
            <p className="muted" style={{ margin: "8px 0 2px" }}>
              Private token: {status?.gateway.privateTokenConfigured ? "Configured" : "Missing"}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Web key: {status?.gateway.publicWebKeyConfigured ? "Configured" : "Missing"}
            </p>
          </div>
        </article>
        <article className="card metricCard">
          <p className="kicker">Rate Limits</p>
          <div>
            <p className="muted" style={{ margin: "8px 0 2px" }}>
              User: {status?.operations.userRateLimitPerMinute}/min
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Org: {status?.operations.orgRateLimitPerMinute}/min
            </p>
          </div>
        </article>
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 10 }}>Tools & Integrations</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Create Vapi credentials and local provider configs for tooling, telephony, storage, and observability.
        </p>

        {error && (
          <p style={{ color: "var(--danger)", marginBottom: 10 }}>{error}</p>
        )}
        {message && (
          <p className="muted" style={{ marginBottom: 10 }}>{message}</p>
        )}

        <div className="split">
          <div className="fieldGrid">
            {providerCategories.map((category) => (
              <div
                key={category.key}
                className="card"
                style={{ padding: 12, background: "rgba(255,255,255,0.02)" }}
              >
                <p className="kicker" style={{ marginBottom: 8 }}>{category.label}</p>
                <div className="inlineActions" style={{ gap: 8 }}>
                  {category.providers.map((provider) => (
                    <button
                      key={provider.key}
                      type="button"
                      className={selectedProviderKey === provider.key ? "" : "secondary"}
                      onClick={() => resetFormForProvider(provider)}
                      style={{ padding: "8px 10px" }}
                    >
                      {provider.badge} {provider.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
            {selectedProvider ? (
              <div className="fieldGrid">
                <div>
                  <h4 style={{ marginBottom: 4 }}>
                    {selectedProvider.label}
                    {selectedProvider.deprecated ? " (Deprecated)" : ""}
                  </h4>
                  <p className="muted" style={{ margin: 0 }}>{selectedProvider.description}</p>
                </div>

                <label>
                  Integration Name
                  <input
                    value={integrationName}
                    onChange={(event) => setIntegrationName(event.target.value)}
                    placeholder={selectedProvider.label}
                  />
                </label>

                <label>
                  Initial Status
                  <select
                    value={createStatus}
                    onChange={(event) => setCreateStatus(event.target.value as "active" | "disabled")}
                  >
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>

                <p className="muted" style={{ margin: "-4px 0 4px" }}>
                  Mode: {selectedProvider.mode === "vapi_credential" ? "Vapi credential" : "Local config"}
                  {selectedProvider.vapiProvider ? ` (${selectedProvider.vapiProvider})` : ""}
                </p>

                {selectedProvider.fields.map((field) => (
                  <ProviderField
                    key={field.key}
                    field={field}
                    value={formValues[field.key]}
                    onChange={(value) => updateFieldValue(field, value)}
                  />
                ))}

                <div className="inlineActions">
                  <button type="button" onClick={() => void createIntegration()} disabled={saving}>
                    {saving ? "Saving..." : "Save Integration"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">Select a provider to configure.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 10 }}>Configured Integrations</h3>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Upstream ID</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.categoryLabel}</td>
                  <td>{item.providerBadge} {item.providerLabel}</td>
                  <td>{item.status}</td>
                  <td>{item.mode}</td>
                  <td>{item.upstreamCredentialId ?? "-"}</td>
                  <td>{new Date(item.updatedAt).toLocaleString()}</td>
                  <td>
                    <div className="inlineActions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={busyIntegrationId === item.id}
                        onClick={() => void toggleIntegrationStatus(item)}
                      >
                        {item.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className="warn"
                        disabled={busyIntegrationId === item.id}
                        onClick={() => void deleteIntegration(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {integrations.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">No integrations configured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h4>Gateway Details</h4>
        <p className="muted">Allowed origins: {status?.gateway.allowedOrigins.join(", ")}</p>
        <p className="muted">
          Last audit: {status?.gateway.lastAuditAt ? new Date(status.gateway.lastAuditAt).toLocaleString() : "-"}
        </p>
        <p className="muted">
          Last call logged: {status?.operations.lastCallAt ? new Date(status.operations.lastCallAt).toLocaleString() : "-"}
        </p>
        <p className="muted">Preview timeout: {status?.operations.previewTimeoutSeconds}s</p>
      </section>
    </div>
  );
}

function ProviderField({
  field,
  value,
  onChange,
}: {
  field: IntegrationField;
  value: string | boolean | undefined;
  onChange: (nextValue: string | boolean) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const commonHelp = field.help ? <p className="muted" style={{ margin: 0 }}>{field.help}</p> : null;

  if (field.type === "boolean") {
    return (
      <label style={{ gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 10 }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        <span>{label}</span>
        {commonHelp}
      </label>
    );
  }

  if (field.type === "json") {
    return (
      <label>
        {label}
        <textarea
          rows={5}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
        {commonHelp}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label>
        {label}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {commonHelp}
      </label>
    );
  }

  return (
    <label>
      {label}
      <input
        type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
      />
      {commonHelp}
    </label>
  );
}

function buildInitialFormState(provider: ProviderCatalogItem): FormState {
  const state: FormState = {};
  for (const field of provider.fields) {
    if (field.type === "boolean") {
      state[field.key] = field.defaultValue === undefined ? false : Boolean(field.defaultValue);
      continue;
    }
    if (field.defaultValue !== undefined) {
      state[field.key] = String(field.defaultValue);
      continue;
    }
    state[field.key] = "";
  }
  return state;
}

