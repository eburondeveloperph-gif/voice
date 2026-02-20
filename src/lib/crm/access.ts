import type { NextRequest } from "next/server";

import { createClient, isSupabaseEnabled } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

type ProjectGate = {
  allowedEmails: string | null;
};

export type SupabaseIdentity = {
  id: string;
  email: string;
};

export function requireSupabaseForCrm(): void {
  if (!isSupabaseEnabled()) {
    throw Object.assign(
      new Error(
        "Supabase is required for CRM. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      ),
      { status: 500 },
    );
  }
}

export function getBearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(/\s+/, 2);
  if (!/^Bearer$/i.test(scheme) || !token?.trim()) {
    throw Object.assign(new Error("Missing Authorization Bearer token."), { status: 401 });
  }
  return token.trim();
}

export async function verifySupabaseIdentityFromToken(token: string): Promise<SupabaseIdentity> {
  requireSupabaseForCrm();
  const client = getSupabaseAdminClient() ?? createClient();
  if (!client) {
    throw Object.assign(new Error("Supabase client is unavailable."), { status: 500 });
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw Object.assign(new Error("Invalid or expired Supabase session."), { status: 401, details: error });
  }

  const email = data.user.email?.trim().toLowerCase();
  if (!email) {
    throw Object.assign(new Error("Supabase user email is required for CRM access."), { status: 403 });
  }

  return { id: data.user.id, email };
}

export function assertProjectEmailAccess(project: ProjectGate, userEmail: string): void {
  const raw = project.allowedEmails?.trim();
  if (!raw) {
    return;
  }

  const allowlist = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    return;
  }

  if (!allowlist.includes(userEmail.toLowerCase())) {
    throw Object.assign(new Error("Your email is not allowed for this CRM project."), { status: 403 });
  }
}
