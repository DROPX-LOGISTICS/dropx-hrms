import Link from "next/link";
import Image from "next/image";
import { BarChart3, CalendarCheck2, CheckSquare2, DoorOpen, Settings2, Users2 } from "lucide-react";
import { HrmsAuthContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { signOut } from "@/app/login/actions";
import { SubmitButton } from "@/components/submit-button";

const nav = [
  { href: "/", label: "Overview", permission: "overview.view" as const, icon: BarChart3 },
  { href: "/people", label: "People", permission: "people.view" as const, icon: Users2 },
  { href: "/attendance", label: "Attendance", permission: "attendance.view" as const, icon: CalendarCheck2 },
  { href: "/leave", label: "Leave", permission: "leave.view" as const, icon: CalendarCheck2 },
  { href: "/approvals", label: "Approvals", permission: "leave.approve" as const, icon: CheckSquare2 },
  { href: "/exits", label: "Exit Management", permission: "exit.view" as const, icon: DoorOpen },
  { href: "/settings", label: "Settings", permission: "settings.manage" as const, icon: Settings2 },
  { href: "/settings/exit", label: "Exit Masters", permission: "settings.manage" as const, icon: Settings2 }
];

export function AppShell({ auth, active, children }: { auth: HrmsAuthContext; active: string; children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Image className="brand-logo" src="/dropx-logo.png" alt="DropX" width={112} height={42} priority />
          <span className="brand-product"><strong>People</strong><small>{auth.companyName}</small></span>
        </Link>
        <nav aria-label="HRMS navigation">
          {nav.filter((item) => can(auth.permissions, item.permission)).map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} className={active === item.label ? "nav-link active" : "nav-link"} href={item.href}><Icon size={18} /><span>{item.label}</span></Link>;
          })}
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
