import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { isSupabaseEnabled } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

type UploadInput = {
  projectSlug: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
  accessToken?: string;
};

export type UploadedCrmFile = {
  path: string;
  publicUrl: string | null;
};

function normalizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function timestampedPath(projectSlug: string, fileName: string): string {
  const safeName = normalizeFileName(fileName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `crm/${projectSlug}/${stamp}-${safeName}`;
}

function resolveStorageClient(accessToken?: string) {
  const adminClient = getSupabaseAdminClient();
  if (adminClient) {
    return adminClient;
  }

  if (isSupabaseEnabled() && accessToken?.trim()) {
    return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
      },
    });
  }

  throw Object.assign(
    new Error("Supabase Storage upload requires SUPABASE_SERVICE_ROLE_KEY or a valid CRM access token."),
    { status: 500 },
  );
}

export async function uploadCrmFileToSupabase(input: UploadInput): Promise<UploadedCrmFile> {
  if (!isSupabaseEnabled()) {
    throw Object.assign(new Error("Supabase is not configured for storage uploads."), { status: 500 });
  }

  const client = resolveStorageClient(input.accessToken);

  const path = timestampedPath(input.projectSlug, input.fileName);
  const { error: uploadError } = await client.storage.from(env.SUPABASE_STORAGE_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    throw Object.assign(new Error(`Failed to upload CRM file to Supabase Storage: ${uploadError.message}`), {
      status: 502,
      details: uploadError,
    });
  }

  const { data: publicData } = client.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  const publicUrl = publicData?.publicUrl ?? null;

  return { path, publicUrl };
}
