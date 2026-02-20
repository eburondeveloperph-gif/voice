import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const INTERNAL_ROOT_SEGMENTS = new Set([
    "dashboard",
    "create",
    "agents",
    "voices",
    "dialer",
    "calls",
    "call-logs",
    "contacts",
    "numbers",
    "settings",
    "crm",
]);

const AUTH_ROUTE = "/auth";

function isInternalRoute(pathname: string): boolean {
    const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
    return INTERNAL_ROOT_SEGMENTS.has(firstSegment);
}

export async function middleware(request: NextRequest) {
    const legacyPortalPathMatch = request.nextUrl.pathname.match(/^\/crm\/([^/]+)\/?$/);
    if (legacyPortalPathMatch) {
        const url = request.nextUrl.clone();
        url.pathname = `/portal/${legacyPortalPathMatch[1]}`;
        return NextResponse.redirect(url);
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        // Supabase is not configured, pass through (components will render a warning if needed)
        return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({
                    request,
                });
                cookiesToSet.forEach(({ name, value }) =>
                    supabaseResponse.cookies.set(name, value)
                );
            },
        },
    });

    // ---------------------------------------------------------------------------
    // ADMIN ROUTE PROTECTION (Basic Auth)
    // ---------------------------------------------------------------------------
    if (request.nextUrl.pathname.startsWith("/admin")) {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return new NextResponse("Authentication required", {
                status: 401,
                headers: { "WWW-Authenticate": 'Basic realm="Admin Access"' },
            });
        }

        const authValue = authHeader.split(" ")[1] ?? "";
        const [user, pwd] = atob(authValue).split(":");

        if (user !== "master@eburon.ai" || pwd !== "120221") {
            return new NextResponse("Authentication required", {
                status: 401,
                headers: { "WWW-Authenticate": 'Basic realm="Admin Access"' },
            });
        }

        // Allowed to proceed to /admin
        return supabaseResponse;
    }

    // ---------------------------------------------------------------------------
    // AUTHENTICATED ROUTES
    // ---------------------------------------------------------------------------
    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with cross-browser cookies.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isAuthRoute = request.nextUrl.pathname === AUTH_ROUTE;
    const isProtected = isInternalRoute(request.nextUrl.pathname);

    if (isProtected && !user) {
        // If user is not signed in and trying to access a protected route,
        // redirect them to the auth page
        const url = request.nextUrl.clone();
        url.pathname = AUTH_ROUTE;
        return NextResponse.redirect(url);
    }

    if (isAuthRoute && user) {
        // If user is already signed in and trying to access the auth page,
        // redirect them to the dashboard
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api (API routes except under certain conditions but generally bypassed)
         */
        "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
