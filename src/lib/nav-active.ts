export function activeNavLabel(pathname: string): string {
  if (pathname === "/settings") return "Settings";
  if (pathname.startsWith("/settings/access")) return "Users & Access";
  if (pathname.startsWith("/settings/attendance-policy")) return "Attendance Policy";
  if (pathname.startsWith("/settings/payroll-heads")) return "Payroll Heads";
  if (pathname.startsWith("/settings/leave-policy")) return "Leave Policy";
  if (pathname.startsWith("/settings/salary")) return "Salary Configuration";
  if (pathname.startsWith("/settings/statutory")) return "Statutory Settings";
  if (pathname.startsWith("/settings/exit")) return "Exit Masters";
  if (pathname.startsWith("/people")) return "People";
  if (pathname.startsWith("/attendance")) return "Attendance";
  if (pathname.startsWith("/leave")) return "Leave";
  if (pathname.startsWith("/approvals")) return "Approvals";
  if (pathname.startsWith("/exits")) return "Exit Management";
  if (pathname.startsWith("/payroll")) return "Salary Process";
  return "Overview";
}
