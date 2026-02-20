"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { createClient, isSupabaseEnabled } from "@/lib/supabase";

const LOGO_URL = "https://eburon.ai/icon-eburon.svg";

type AuthMode = "login" | "register";
const MAX_COMPANY_LOGO_BYTES = 5 * 1024 * 1024;

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"submit" | "recover" | "resend" | null>(null);
  const supabaseEnabled = isSupabaseEnabled();

  // With middleware, we don't strictly need these client-side redirect checks
  // on mount anymore, as middleware protects the route. However, we keep the
  // event listener so that when a user logs in, the page updates/redirects smoothly
  // without a manual refresh.
  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = createClient();
    if (!sb) return;

    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        router.refresh();
        router.replace("/dashboard");
      }
    });

    const { data: subscription } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.refresh();
        router.replace("/dashboard");
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [router, supabaseEnabled]);

  async function sendPasswordReset() {
    if (!supabaseEnabled) {
      setStatus("Supabase auth is not configured.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus("Enter your email first, then request a reset link.");
      return;
    }

    const sb = createClient();
    if (!sb) {
      setStatus("Supabase auth client is unavailable.");
      return;
    }

    setBusyAction("recover");
    setStatus(null);
    try {
      const { error } = await sb.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus("Password reset link sent. Check your inbox.");
    } finally {
      setBusyAction(null);
    }
  }

  async function resendVerificationEmail() {
    if (!supabaseEnabled) {
      setStatus("Supabase auth is not configured.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus("Enter your email first to resend verification.");
      return;
    }

    const sb = createClient();
    if (!sb) {
      setStatus("Supabase auth client is unavailable.");
      return;
    }

    setBusyAction("resend");
    setStatus(null);
    try {
      const { error } = await sb.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus("Verification email resent.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseEnabled) {
      setStatus("Supabase auth is not configured.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setStatus("Email and password are required.");
      return;
    }

    if (mode === "register") {
      if (!companyName.trim()) {
        setStatus("Company name is required.");
        return;
      }
      if (companyLogoFile) {
        if (!companyLogoFile.type.toLowerCase().startsWith("image/")) {
          setStatus("Company logo must be an image file.");
          return;
        }
        if (companyLogoFile.size > MAX_COMPANY_LOGO_BYTES) {
          setStatus("Company logo is too large. Max size is 5MB.");
          return;
        }
      }
      if (password.length < 8) {
        setStatus("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setStatus("Password confirmation does not match.");
        return;
      }
    }

    const sb = createClient();
    if (!sb) {
      setStatus("Supabase auth client is unavailable.");
      return;
    }

    setBusyAction("submit");
    setStatus(null);
    try {
      if (mode === "register") {
        const { data, error } = await sb.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (error) {
          setStatus(error.message);
          return;
        }

        const provisionPayload = new FormData();
        provisionPayload.set("companyName", companyName.trim());
        if (companySlug.trim()) {
          provisionPayload.set("companySlug", companySlug.trim());
        }
        if (companyDescription.trim()) {
          provisionPayload.set("companyDescription", companyDescription.trim());
        }
        provisionPayload.set("ownerEmail", normalizedEmail);
        if (companyLogoFile) {
          provisionPayload.set("companyLogo", companyLogoFile);
        }

        const provisionHeaders: HeadersInit = {};
        if (data.session?.access_token) {
          provisionHeaders.Authorization = `Bearer ${data.session.access_token}`;
        }

        const provisionRes = await fetch("/api/ev/crm/projects/auto", {
          method: "POST",
          headers: provisionHeaders,
          body: provisionPayload,
        });

        if (!provisionRes.ok) {
          const payload = (await provisionRes.json().catch(() => ({}))) as { error?: string };
          setStatus(payload.error ?? "Account created, but CRM setup failed. Please contact support.");
          return;
        }

        if (data.session) {
          router.replace("/dashboard");
          return;
        }

        setStatus("Account created. Check your email to verify, then sign in. Your CRM portal is ready.");
        setMode("login");
        setCompanyName("");
        setCompanySlug("");
        setCompanyDescription("");
        setCompanyLogoFile(null);
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const { error } = await sb.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      router.replace("/dashboard");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="authRoot">
      <div className="authGlow authGlowA" aria-hidden />
      <div className="authGlow authGlowB" aria-hidden />
      <div className="authShell authShellSingle">
        <section className="card authSinglePanel">
          <header className="authSingleHeader">
            <div className="authSingleBrand">
              <div className="authBrandBadge">
                <Image src={LOGO_URL} alt="Eburon Voice" width={36} height={36} />
              </div>
              <div>
                <p className="authEyebrow">Eburon Voice</p>
                <h1 className="authSingleTitle">CSR Admin Console</h1>
              </div>
            </div>
            <p className="authSingleSubtitle">
              Secure access for operations teams managing voice agents, call routing, and client CRM workspaces.
            </p>
          </header>

          <div className="authModeTabs" role="tablist" aria-label="Auth mode">
            {mode === "login" ? (
              <button
                type="button"
                className="authModeButton active"
                onClick={() => {
                  setMode("login");
                  setStatus(null);
                }}
                role="tab"
                aria-selected="true"
              >
                Login
              </button>
            ) : (
              <button
                type="button"
                className="authModeButton"
                onClick={() => {
                  setMode("login");
                  setStatus(null);
                }}
                role="tab"
                aria-selected="false"
              >
                Login
              </button>
            )}

            {mode === "register" ? (
              <button
                type="button"
                className="authModeButton active"
                onClick={() => {
                  setMode("register");
                  setStatus(null);
                }}
                role="tab"
                aria-selected="true"
              >
                Register
              </button>
            ) : (
              <button
                type="button"
                className="authModeButton"
                onClick={() => {
                  setMode("register");
                  setStatus(null);
                }}
                role="tab"
                aria-selected="false"
              >
                Register
              </button>
            )}
          </div>

          <h2 className="authFormTitle">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted authFormCopy">
            {mode === "login"
              ? "Sign in with your Eburon Voice email credentials."
              : "Register with your work email to access the Eburon Voice dashboard."}
          </p>

          {!supabaseEnabled ? (
            <p className="muted">
              Supabase auth is not configured. Add `NEXT_PUBLIC_SUPABASE_URL` and
              `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your environment.
            </p>
          ) : (
            <form className="authForm" onSubmit={(event) => void handleSubmit(event)}>
              <label>
                Work Email
                <input
                  type="email"
                  autoComplete="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </label>

              {mode === "register" ? (
                <>
                  <label>
                    Company Name
                    <input
                      type="text"
                      autoComplete="organization"
                      id="companyName"
                      name="companyName"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Acme Corporation"
                      required
                    />
                  </label>

                  <label>
                    Company Slug (optional)
                    <input
                      type="text"
                      id="companySlug"
                      name="companySlug"
                      value={companySlug}
                      onChange={(event) => setCompanySlug(event.target.value)}
                      placeholder="acme-corp"
                    />
                  </label>

                  <label>
                    Company Description (optional)
                    <textarea
                      id="companyDescription"
                      name="companyDescription"
                      rows={3}
                      value={companyDescription}
                      onChange={(event) => setCompanyDescription(event.target.value)}
                      placeholder="Brief description of your company and CRM use."
                    />
                  </label>

                  <label>
                    Company Logo (optional)
                    <input
                      type="file"
                      id="companyLogo"
                      name="companyLogo"
                      accept="image/*"
                      onChange={(event) => setCompanyLogoFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </>
              ) : null}

              <label>
                Password
                {mode === "login" ? (
                  <input
                    type="password"
                    id="password-login"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                    required
                  />
                ) : (
                  <input
                    type="password"
                    id="password-register"
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                )}
              </label>

              {mode === "register" ? (
                <label>
                  Confirm Password
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    required
                  />
                </label>
              ) : null}

              <button type="submit" disabled={busyAction !== null}>
                {busyAction === "submit"
                  ? "Submitting..."
                  : mode === "login"
                    ? "Login to Eburon Voice"
                    : "Register Account"}
              </button>

              <div className="authAuxActions">
                {mode === "login" ? (
                  <button
                    type="button"
                    className="ghost authAuxButton"
                    onClick={() => void sendPasswordReset()}
                    disabled={busyAction !== null}
                  >
                    {busyAction === "recover" ? "Sending reset link..." : "Forgot password?"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost authAuxButton"
                    onClick={() => void resendVerificationEmail()}
                    disabled={busyAction !== null}
                  >
                    {busyAction === "resend" ? "Resending..." : "Resend verification email"}
                  </button>
                )}
              </div>
            </form>
          )}

          {status ? <p className="muted authStatus">{status}</p> : null}
        </section>
      </div>
    </div>
  );
}
