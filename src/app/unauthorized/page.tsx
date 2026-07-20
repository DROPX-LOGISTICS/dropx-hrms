import Link from "next/link";

export default function UnauthorizedPage() {
  return <main className="center-page"><section className="empty-state"><h1>Access restricted</h1><p>Your HRMS role does not allow this action.</p><Link className="button primary" href="/">Return to overview</Link></section></main>;
}
