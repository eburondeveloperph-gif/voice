"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/client/api";
import type { IntegrationProviderDefinition } from "@/lib/ev/integrations";

interface Integration {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  providerKey: string;
  providerLabel: string;
  providerBadge: string;
  description: string;
  mode: string;
  eburonProvider: string | null;
  upstreamCredentialId: string | null;
  status: "active" | "disabled";
  deprecated: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationCategory {
  key: string;
  label: string;
  providers: IntegrationProviderDefinition[];
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [categories, setCategories] = useState<IntegrationCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadIntegrations();
    loadCategories();
  }, []);

  const loadIntegrations = async () => {
    try {
      const response = await apiRequest<{ integrations: Integration[] }>("/api/ev/settings/integrations");
      setIntegrations(response.integrations || []);
    } catch (error) {
      console.error("Failed to load integrations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiRequest<{ categories: IntegrationCategory[] }>("/api/ev/settings/integrations/categories");
      setCategories(response.categories || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const filteredIntegrations = integrations.filter(integration => {
    const matchesCategory = selectedCategory === "all" || integration.category === selectedCategory;
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return "✓";
      case "disabled": return "✕";
      default: return "○";
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      tool_providers: "🔧",
      vector_store_providers: "🗃️",
      phone_number_providers: "📞",
      cloud_providers: "☁️",
      observability_providers: "📊",
      server_configuration: "⚙️",
    };
    return icons[category] || "📦";
  };

  if (isLoading) {
    return (
      <div className="integrationsContainer">
        <div className="loadingState">
          <div className="loadingSpinner"></div>
          <p>Loading integrations...</p>
        </div>
        <style jsx>{`
          .integrationsContainer {
            max-width: 1200px;
            margin: 0 auto;
            padding: 24px;
            min-height: 400px;
          }

          .loadingState {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 300px;
            gap: 16px;
          }

          .loadingSpinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top: 3px solid var(--accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .loadingState p {
            color: var(--muted);
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="integrationsContainer">
      <div className="integrationsHeader">
        <h1 className="integrationsTitle">🔌 Integrations</h1>
        <p className="integrationsSubtitle">
          Connect Eburon Voice with your favorite tools and services
        </p>
      </div>

      <div className="integrationsControls">
        <div className="searchBar">
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="searchInput"
          />
          <div className="searchIcon">🔍</div>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="addIntegrationBtn"
        >
          + Add Integration
        </button>
      </div>

      <div className="categoryTabs">
        <button
          className={`categoryTab ${selectedCategory === "all" ? "active" : ""}`}
          onClick={() => setSelectedCategory("all")}
        >
          All Integrations
        </button>
        {categories.map((category) => (
          <button
            key={category.key}
            className={`categoryTab ${selectedCategory === category.key ? "active" : ""}`}
            onClick={() => setSelectedCategory(category.key)}
          >
            {getCategoryIcon(category.key)} {category.label}
          </button>
        ))}
      </div>

      <div className="integrationsGrid">
        {filteredIntegrations.map((integration) => (
          <div key={integration.id} className="integrationCard">
            <div className="integrationHeader">
              <div className="integrationBadge">
                <span className="badgeIcon">{integration.providerBadge}</span>
                <span className="badgeText">{integration.providerLabel}</span>
              </div>
              <div className={`integrationStatus status-${integration.status}`}>
                <span className="statusIcon">{getStatusIcon(integration.status)}</span>
                <span className="statusText">{integration.status}</span>
              </div>
            </div>

            <h3 className="integrationName">{integration.name}</h3>
            <p className="integrationDescription">{integration.description}</p>

            <div className="integrationMeta">
              <div className="metaItem">
                <span className="metaLabel">Category:</span>
                <span className="metaValue">
                  {getCategoryIcon(integration.category)} {integration.categoryLabel}
                </span>
              </div>
              <div className="metaItem">
                <span className="metaLabel">Mode:</span>
                <span className="metaValue">{integration.mode}</span>
              </div>
              {integration.eburonProvider && (
                <div className="metaItem">
                  <span className="metaLabel">Provider:</span>
                  <span className="metaValue">{integration.eburonProvider}</span>
                </div>
              )}
            </div>

            <div className="integrationActions">
              <button className="actionBtn configure">
                ⚙️ Configure
              </button>
              <button className="actionBtn test">
                🧪 Test
              </button>
              {integration.status === "active" ? (
                <button className="actionBtn disable">
                  ⏸️ Disable
                </button>
              ) : (
                <button className="actionBtn enable">
                  ▶️ Enable
                </button>
              )}
            </div>

            {integration.deprecated && (
              <div className="deprecatedBadge">
                ⚠️ Deprecated
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="emptyState">
          <div className="emptyIcon">🔌</div>
          <h3>No integrations found</h3>
          <p>
            {searchTerm ? "Try adjusting your search terms" : "Get started by adding your first integration"}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowAddModal(true)}
              className="addIntegrationBtn primary"
            >
              + Add Your First Integration
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .integrationsContainer {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        .integrationsHeader {
          text-align: center;
          margin-bottom: 32px;
        }

        .integrationsTitle {
          font-size: 48px;
          font-weight: 700;
          margin: 0 0 16px;
          background: linear-gradient(135deg, #e1502e, #3b59ab);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .integrationsSubtitle {
          color: var(--muted);
          margin: 0;
          font-size: 18px;
          max-width: 600px;
          margin: 0 auto;
        }

        .integrationsControls {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
          align-items: center;
          flex-wrap: wrap;
        }

        .searchBar {
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .searchInput {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .searchInput:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(225, 80, 46, 0.15);
        }

        .searchIcon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
        }

        .addIntegrationBtn {
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          background: var(--gradient);
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .addIntegrationBtn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(225, 80, 46, 0.3);
        }

        .addIntegrationBtn.primary {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .categoryTabs {
          display: flex;
          gap: 12px;
          margin-bottom: 32px;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .categoryTab {
          padding: 10px 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 25px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--muted);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          white-space: nowrap;
        }

        .categoryTab:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text);
        }

        .categoryTab.active {
          background: var(--gradient);
          color: white;
          border-color: transparent;
        }

        .integrationsGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .integrationCard {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--shadow);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          position: relative;
        }

        .integrationCard:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }

        .integrationHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .integrationBadge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }

        .badgeIcon {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: var(--gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .badgeText {
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
        }

        .integrationStatus {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .integrationStatus.status-active {
          color: #22c55e;
        }

        .integrationStatus.status-disabled {
          color: #ef4444;
        }

        .integrationName {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px;
          line-height: 1.3;
        }

        .integrationDescription {
          color: var(--muted);
          margin: 0 0 16px;
          line-height: 1.5;
          font-size: 14px;
        }

        .integrationMeta {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .metaItem {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }

        .metaLabel {
          color: var(--muted);
        }

        .metaValue {
          font-weight: 600;
          color: var(--text);
        }

        .integrationActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .actionBtn {
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .actionBtn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .actionBtn.configure {
          border-color: var(--accent);
          color: var(--accent);
        }

        .actionBtn.test {
          border-color: #22c55e;
          color: #22c55e;
        }

        .actionBtn.disable {
          border-color: #ef4444;
          color: #ef4444;
        }

        .actionBtn.enable {
          border-color: #22c55e;
          color: #22c55e;
        }

        .deprecatedBadge {
          position: absolute;
          top: 16px;
          right: 16px;
          padding: 4px 8px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #ef4444;
        }

        .emptyState {
          text-align: center;
          padding: 64px 24px;
        }

        .emptyIcon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .emptyState h3 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--text);
        }

        .emptyState p {
          color: var(--muted);
          margin: 0 0 24px;
        }

        @media (max-width: 768px) {
          .integrationsContainer {
            padding: 16px;
          }

          .integrationsTitle {
            font-size: 36px;
          }

          .integrationsControls {
            flex-direction: column;
            align-items: stretch;
          }

          .searchBar {
            max-width: none;
          }

          .integrationsGrid {
            grid-template-columns: 1fr;
          }

          .integrationActions {
            justify-content: stretch;
          }

          .actionBtn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
