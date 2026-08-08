"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarCheck2, CalendarDays, CheckSquare2, CircleDollarSign, DoorOpen, ListTree, Receipt, Settings2, UserCog, Users2, Wallet } from "lucide-react";
import type { HrmsAuthClientContext } from "@/lib/auth";
import { activeNavLabel } from "@/lib/nav-active";
import { can } from "@/lib/permissions";
import { signOut } from "@/app/login/actions";
import { SubmitButton } from "@/components/submit-button";

const mainNav = [
  { href: "/", label: "Overview", permission: "overview.view" as const, icon: BarChart3 },
  { href: "/people", label: "People", permission: "people.view" as const, icon: Users2 },
  { href: "/attendance", label: "Attendance", permission: "attendance.view" as const, icon: CalendarCheck2 },
  { href: "/leave", label: "Leave", permission: "leave.view" as const, icon: CalendarCheck2 },
  { href: "/approvals", label: "Approvals", permission: "leave.approve" as const, icon: CheckSquare2 },
  { href: "/exits", label: "Exit Management", permission: "exit.view" as const, icon: DoorOpen },
  { href: "/payroll", label: "Salary Process", permission: "payroll.view" as const, icon: Wallet }
];

const settingsNav = [
  { href: "/settings/access", label: "Users & Access", icon: UserCog },
  { href: "/settings/attendance-policy", label: "Attendance Policy", icon: CalendarCheck2 },
  { href: "/settings/payroll-heads", label: "Payroll Heads", icon: ListTree },
  { href: "/settings/leave-policy", label: "Leave Policy", icon: CalendarDays },
  { href: "/settings/salary", label: "Salary Configuration", icon: CircleDollarSign },
  { href: "/settings/statutory", label: "Statutory Settings", icon: Receipt },
  { href: "/settings/exit", label: "Exit Masters", icon: DoorOpen }
];

export function AppShell({ auth, children, contentPending = false }: { auth: HrmsAuthClientContext; children: React.ReactNode; contentPending?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeNavLabel(pathname);

  function prefetchOnHover(href: string) {
    return () => router.prefetch(href);
  }

  return (
    <div className={contentPending ? "app-layout app-layout-pending" : "app-layout"} aria-busy={contentPending || undefined}>
      {contentPending ? (
        <div className="app-loading-overlay" aria-hidden="true">
          <div className="app-loading-dots" role="status" aria-label="Loading">
            <span /><span /><span />
          </div>
        </div>
      ) : null}
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Image className="brand-logo" src="/dropx-logo.png" alt="DropX" width={112} height={42} priority />
          <span className="brand-product"><strong>People</strong><small>{auth.companyName}</small></span>
        </Link>
        <nav aria-label="HRMS navigation">
          {mainNav.filter((item) => can(auth.permissions, item.permission)).map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} className={active === item.label ? "nav-link active" : "nav-link"} href={item.href} prefetch={false} onMouseEnter={prefetchOnHover(item.href)} onFocus={prefetchOnHover(item.href)}><Icon size={16} /><span>{item.label}</span></Link>;
          })}
          {can(auth.permissions, "settings.manage") ? <>
            <Link className={active === "Settings" || settingsNav.some((item) => item.label === active) ? "nav-link section-active" : "nav-link"} href="/settings" prefetch={false} onMouseEnter={prefetchOnHover("/settings")} onFocus={prefetchOnHover("/settings")}><Settings2 size={16} /><span>Settings</span></Link>
            <div className="settings-subnav">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                return <Link key={item.href} className={active === item.label ? "nav-link sub-nav-link active" : "nav-link sub-nav-link"} href={item.href} prefetch={false} onMouseEnter={prefetchOnHover(item.href)} onFocus={prefetchOnHover(item.href)}><Icon size={14} /><span>{item.label}</span></Link>;
              })}
            </div>
          </> : null}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{auth.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
          <div><strong>{auth.fullName}</strong><small>{auth.roleCode.replaceAll("_", " ")}</small></div>
          <form action={signOut}><SubmitButton className="link-button" pendingLabel="Signing out…">Sign out</SubmitButton></form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
