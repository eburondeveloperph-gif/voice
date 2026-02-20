import { createServerClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { isSupabaseAdminEnabled, isSupabaseEnabled } from "@/lib/supabase";

/**
 * Public-key Supabase client for use in Server actions and Route handlers.
 */
export async function createClientServer(): Promise<SupabaseClient | null> {
    if (!isSupabaseEnabled()) return null;
    const cookieStore = await cookies();

    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

/**
 * Service-role Supabase client for trusted server routes.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
    if (!isSupabaseAdminEnabled()) return null;
    // This bypasses RLS and uses the admin key
    return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        cookies: {
            getAll() {
                return [];
            },
            setAll() {
                // No cookies needed for admin client
            },
        },
    });
}
