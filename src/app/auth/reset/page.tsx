"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { createClient, isSupabaseEnabled } from "@/lib/supabase";

const LOGO_URL = "https://eburon.ai/icon-eburon.svg";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const supabaseEnabled = isSupabaseEnabled();

  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = createClient();
    if (!sb) return;

    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setRecoveryReady(true);
        return;
      }
      setStatus("Open this page from the password recovery email link.");
    });

    const { data: subscription } = sb.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY" || nextSession) {
        setRecoveryReady(true);
        setStatus(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabaseEnabled]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseEnabled) {
      setStatus("Supabase auth is not configured.");
      return;
    }
    if (!recoveryReady) {
      setStatus("Recovery session not found. Re-open the recovery email link.");
      return;
    }
    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("Password confirmation does not match.");
      return;
    }

    const sb = createClient();
    if (!sb) {
      setStatus("Supabase auth client is unavailable.");
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        setStatus(error.message);
        return;
      }
      await sb.auth.signOut();
      setStatus("Password updated. Redirecting to login...");
      window.setTimeout(() => {
        router.replace("/auth");
      }, 900);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="authRoot">
      <div className="authGlow authGlowA" aria-hidden />
      <div className="authGlow authGlowB" aria-hidden />
      <div className="authShell authResetShell">
        <section className="authBrandPanel">
          <div className="authBrandLockup">
            <div className="authBrandBadge">
              <Image src={LOGO_URL} alt="Eburon Voice" width={36} height={36} />
            </div>
            <div>
              <p className="authEyebrow">Eburon Voice</p>
              <h1 className="authHeading">Reset Password</h1>
            </div>
          </div>
          <p className="authBrandText">Create a new secure password to continue using your admin console account.</p>
        </section>

        <section className="card authCardPanel">
          <h2 className="authFormTitle">Set a new password</h2>
          <p className="muted authFormCopy">Use at least 8 characters. Avoid reusing previous passwords.</p>

          {!supabaseEnabled ? (
            <p className="muted">
              Supabase auth is not configured. Add `NEXT_PUBLIC_SUPABASE_URL` and
              `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your environment.
            </p>
          ) : (
            <form className="authForm" onSubmit={(event) => void handleSubmit(event)}>
              <label>
                New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </label>

              <label>
                Confirm New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </label>

              <button type="submit" disabled={submitting || !recoveryReady}>
                {submitting ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          {status ? <p className="muted authStatus">{status}</p> : null}
          <p className="muted authStatus">
            <Link href="/auth" className="authLink">
              Back to login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
