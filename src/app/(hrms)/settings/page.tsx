import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarDays, CircleDollarSign, DoorOpen, ListTree, Receipt, UserCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireHrmsAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };
export default async function SettingsPage() {
  await requireHrmsAuth("settings.manage");
  return <>
    <PageHeader eyebrow="Administration" title="Settings" description="Manage attendance, leave, payroll and exit policy masters." />

    <section className="settings-directory">
      <Link className="settings-card" href="/settings/access"><UserCog size={20} /><span><strong>Users & Access</strong><small>Manage access to the People frontend only.</small></span></Link>
      <Link className="settings-card" href="/settings/attendance-policy"><CalendarCheck2 size={20} /><span><strong>Attendance Policy</strong><small>Configure working days and attendance thresholds.</small></span></Link>
      <Link className="settings-card" href="/settings/payroll-heads"><ListTree size={20} /><span><strong>Payroll Heads</strong><small>Create earning, deduction and statutory payroll heads.</small></span></Link>
      <Link className="settings-card" href="/settings/leave-policy"><CalendarDays size={20} /><span><strong>Leave Policy</strong><small>Configure the leave year and leave types.</small></span></Link>
      <Link className="settings-card" href="/settings/salary"><CircleDollarSign size={20} /><span><strong>Salary Configuration</strong><small>Create salary structures with values, equations and limits.</small></span></Link>
      <Link className="settings-card" href="/settings/statutory"><Receipt size={20} /><span><strong>Statutory Settings</strong><small>Configure PF, ESI, professional tax and TDS parameters.</small></span></Link>
      <Link className="settings-card" href="/settings/exit"><DoorOpen size={20} /><span><strong>Exit Masters</strong><small>Configure reasons, tasks, documents and notifications.</small></span></Link>
    </section>
  </>;
}
