import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarDays, CircleDollarSign, DoorOpen, ListTree } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireHrmsAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireHrmsAuth("settings.manage");
  return <AppShell auth={auth} active="Settings">
    <PageHeader eyebrow="Administration" title="Settings" description="Manage attendance, leave, payroll and exit policy masters." />

    <section className="settings-directory">
      <Link className="settings-card" href="/settings/attendance-policy"><CalendarCheck2 size={20} /><span><strong>Attendance Policy</strong><small>Configure working days and attendance thresholds.</small></span></Link>
      <Link className="settings-card" href="/settings/payroll-heads"><ListTree size={20} /><span><strong>Payroll Heads</strong><small>Create earning, deduction and statutory payroll heads.</small></span></Link>
      <Link className="settings-card" href="/settings/leave-policy"><CalendarDays size={20} /><span><strong>Leave Policy</strong><small>Configure the leave year and leave types.</small></span></Link>
      <Link className="settings-card" href="/settings/salary"><CircleDollarSign size={20} /><span><strong>Salary Configuration</strong><small>Create salary structures with values, equations and limits.</small></span></Link>
      <Link className="settings-card" href="/settings/exit"><DoorOpen size={20} /><span><strong>Exit Masters</strong><small>Configure reasons, tasks, documents and notifications.</small></span></Link>
    </section>
  </AppShell>;
}
