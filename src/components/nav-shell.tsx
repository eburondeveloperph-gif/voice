"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { createClient, isSupabaseEnabled } from "@/lib/supabase";

const LOGO_URL = "https://eburon.ai/icon-eburon.svg";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◧" },
  { href: "/create", label: "Create", icon: "+" },
  { href: "/agents", label: "Agents", icon: "◎" },
  { href: "/voices", label: "Voices", icon: "◉" },
  { href: "/dialer", label: "Dialer", icon: "◌" },
  { href: "/calls/bulk", label: "Bulk Calls", icon: "▦" },
  { href: "/call-logs", label: "Call Logs", icon: "☰" },
  { href: "/contacts", label: "Contacts", icon: "◍" },
  { href: "/crm", label: "Client CRM", icon: "⌁" },
  { href: "/numbers", label: "Numbers", icon: "#" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function NavShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authEnabled = isSupabaseEnabled();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("ev.sidebar.collapsed") === "1";
  });
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (!authEnabled) return;
    const sb = createClient();
    if (!sb) return;

    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (active) {
        setAccountEmail(data.session?.user.email ?? null);
      }
    });

    const { data: subscription } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setAccountEmail(nextSession?.user.email ?? null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [authEnabled]);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("ev.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function signOut() {
    setLogoutLoading(true);
    try {
      const sb = createClient();
      if (sb) {
        await sb.auth.signOut();
      }
    } finally {
      setLogoutLoading(false);
      router.replace("/auth");
    }
  }

  return (
    <div className={`shell ${collapsed ? "sidebarCollapsed" : ""}`}>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="brandPanel">
          <div className="brandBadge">
            <Image
              src={LOGO_URL}
              alt="Eburon"
              width={24}
              height={24}
            />
          </div>
          <div className="brandCopy">
            <p className="brandName">Eburon Voice</p>
            <p className="brandSub">CSR Agent Builder</p>
          </div>
          <button
            type="button"
            className="sidebarToggle"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="sidebarNav" aria-label="Main">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`navLink ${pathname === item.href ? "active" : ""}`}
              title={item.label}
              aria-label={item.label}
            >
              <span className="navIcon" aria-hidden>
                {item.icon}
              </span>
              <span className="navText">{item.label}</span>
            </Link>
          ))}
        </nav>

        {authEnabled ? (
          <div className="sidebarFooter">
            {!collapsed ? (
              <p className="sidebarUserEmail">{accountEmail ?? "Signed in user"}</p>
            ) : null}
            <button
              type="button"
              className="sidebarLogoutButton"
              onClick={() => void signOut()}
              disabled={logoutLoading}
              title="Logout"
            >
              <span className="navIcon" aria-hidden>
                ⎋
              </span>
              <span className="navText">{logoutLoading ? "Signing out..." : "Logout"}</span>
            </button>
          </div>
        ) : null}
      </aside>

      <main className="content">{children}</main>

      <nav className="bottomNav" aria-label="Mobile main">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottomLink ${pathname === item.href ? "active" : ""}`}
          >
            <span className="bottomIcon" aria-hidden>
              {item.icon}
            </span>
            <span className="bottomText">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
