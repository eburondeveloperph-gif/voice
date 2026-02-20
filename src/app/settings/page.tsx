"use client";

import { useState, useEffect } from "react";

interface SettingsState {
  theme: "dark" | "light";
  notifications: boolean;
  autoSave: boolean;
  language: string;
  timezone: string;
  apiKey: string;
  webhookUrl: string;
  maxCalls: number;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
}

const defaultSettings: SettingsState = {
  theme: "dark",
  notifications: true,
  autoSave: true,
  language: "en",
  timezone: "UTC",
  apiKey: "",
  webhookUrl: "",
  maxCalls: 1000,
  recordingEnabled: true,
  transcriptionEnabled: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const savedSettings = localStorage.getItem("eburon-settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus("saving");
    
    try {
      localStorage.setItem("eburon-settings", JSON.stringify(settings));
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem("eburon-settings");
  };

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="settingsContainer">
      <div className="settingsHeader">
        <h1 className="settingsTitle">Settings</h1>
        <p className="settingsSubtitle">Manage your Eburon Voice configuration</p>
      </div>

      <div className="settingsGrid">
        <div className="settingsCard">
          <h2 className="cardTitle">General</h2>
          <div className="fieldGrid">
            <div>
              <label>Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => updateSetting("theme", e.target.value as "dark" | "light")}
                title="Theme selection"
                aria-label="Theme"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div>
              <label>Language</label>
              <select
                value={settings.language}
                onChange={(e) => updateSetting("language", e.target.value)}
                title="Language selection"
                aria-label="Language"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
            <div>
              <label>Timezone</label>
              <select
                value={settings.timezone}
                onChange={(e) => updateSetting("timezone", e.target.value)}
                title="Timezone selection"
                aria-label="Timezone"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settingsCard">
          <h2 className="cardTitle">Notifications</h2>
          <div className="fieldGrid">
            <div className="toggleField">
              <label>Enable Notifications</label>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => updateSetting("notifications", e.target.checked)}
                title="Enable Notifications"
                aria-label="Enable Notifications"
              />
            </div>
            <div className="toggleField">
              <label>Auto-save Changes</label>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => updateSetting("autoSave", e.target.checked)}
                title="Auto-save Changes"
                aria-label="Auto-save Changes"
              />
            </div>
          </div>
        </div>

        <div className="settingsCard">
          <h2 className="cardTitle">Eburon API</h2>
          <div className="fieldGrid">
            <div>
              <label>API Key</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => updateSetting("apiKey", e.target.value)}
                placeholder="Enter your Eburon API key"
                title="API Key"
                aria-label="API Key"
              />
            </div>
            <div>
              <label>Webhook URL</label>
              <input
                type="url"
                value={settings.webhookUrl}
                onChange={(e) => updateSetting("webhookUrl", e.target.value)}
                placeholder="https://your-app.com/webhook"
                title="Webhook URL"
                aria-label="Webhook URL"
              />
            </div>
            <div>
              <label>Max Monthly Calls</label>
              <input
                type="number"
                value={settings.maxCalls}
                onChange={(e) => updateSetting("maxCalls", parseInt(e.target.value) || 0)}
                min="0"
                max="10000"
                title="Max Monthly Calls"
                aria-label="Max Monthly Calls"
              />
            </div>
          </div>
        </div>

        <div className="settingsCard">
          <h2 className="cardTitle">Voice Features</h2>
          <div className="fieldGrid">
            <div className="toggleField">
              <label>Enable Recording</label>
              <input
                type="checkbox"
                checked={settings.recordingEnabled}
                onChange={(e) => updateSetting("recordingEnabled", e.target.checked)}
                title="Enable Recording"
                aria-label="Enable Recording"
              />
            </div>
            <div className="toggleField">
              <label>Enable Transcription</label>
              <input
                type="checkbox"
                checked={settings.transcriptionEnabled}
                onChange={(e) => updateSetting("transcriptionEnabled", e.target.checked)}
                title="Enable Transcription"
                aria-label="Enable Transcription"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settingsActions">
        <div className="actionButtons">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className={`saveButton ${saveStatus}`}
          >
            {isLoading ? "Saving..." : saveStatus === "saved" ? "✓ Saved" : "Save Changes"}
          </button>
          <button onClick={handleReset} className="resetButton">
            Reset to Defaults
          </button>
        </div>
        {saveStatus === "error" && (
          <p className="errorMessage">Failed to save settings. Please try again.</p>
        )}
      </div>

      <style jsx>{`
        .settingsContainer {
          max-width: 800px;
          margin: 0 auto;
          padding: 24px;
        }

        .settingsHeader {
          margin-bottom: 32px;
        }

        .settingsTitle {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 8px;
          background: linear-gradient(135deg, #e1502e, #3b59ab);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .settingsSubtitle {
          color: var(--muted);
          margin: 0;
          font-size: 16px;
        }

        .settingsGrid {
          display: grid;
          gap: 24px;
          margin-bottom: 32px;
        }

        .settingsCard {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--shadow);
        }

        .cardTitle {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 20px;
          color: var(--text);
        }

        .fieldGrid {
          display: grid;
          gap: 16px;
        }

        .fieldGrid label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--muted);
        }

        .fieldGrid input,
        .fieldGrid select {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .fieldGrid input:focus,
        .fieldGrid select:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(225, 80, 46, 0.15);
        }

        .toggleField {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
        }

        .toggleField input[type="checkbox"] {
          width: 48px;
          height: 24px;
          appearance: none;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          position: relative;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .toggleField input[type="checkbox"]:checked {
          background: var(--gradient);
        }

        .toggleField input[type="checkbox"]::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.3s ease;
        }

        .toggleField input[type="checkbox"]:checked::after {
          transform: translateX(24px);
        }

        .settingsActions {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: flex-end;
        }

        .actionButtons {
          display: flex;
          gap: 12px;
        }

        .saveButton {
          padding: 12px 24px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--gradient);
          color: white;
        }

        .saveButton:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(225, 80, 46, 0.3);
        }

        .saveButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .saveButton.saved {
          background: linear-gradient(135deg, #4ade80, #22c55e);
        }

        .resetButton {
          padding: 12px 24px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .resetButton:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .errorMessage {
          color: #ef4444;
          font-size: 14px;
          margin: 0;
        }

        @media (max-width: 768px) {
          .settingsContainer {
            padding: 16px;
          }

          .actionButtons {
            flex-direction: column;
            width: 100%;
          }

          .saveButton,
          .resetButton {
            width: 100%;
          }

          .settingsActions {
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
}
