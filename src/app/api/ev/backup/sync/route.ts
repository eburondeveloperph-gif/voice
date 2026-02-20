import { NextResponse } from "next/server";

import { isSupabaseEnabled } from "@/lib/supabase";
import { backupAll } from "@/lib/ev/backup";

/**
 * POST /api/ev/backup/sync
 *
 * Triggers a full bulk sync from Prisma (SQLite) → Supabase.
 * Use this for initial population or periodic reconciliation.
 */
export async function POST() {
    if (!isSupabaseEnabled()) {
        return NextResponse.json(
            { error: "Supabase backup is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
            { status: 503 },
        );
    }

    const counts = await backupAll();

    return NextResponse.json({
        ok: true,
        synced: counts,
        timestamp: new Date().toISOString(),
    });
}
