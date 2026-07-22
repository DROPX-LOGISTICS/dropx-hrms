export default function LoadingEmployeeProfile() {
  return <div className="employee-profile-sections" aria-live="polite" aria-busy="true">
    <section className="panel employee-avatar-card">
      <span className="employee-avatar employee-avatar-large"><span className="loading-spinner" /></span>
      <div className="employee-avatar-card-copy"><p className="eyebrow">Employee profile</p><h2>Loading employee…</h2><p>Fetching complete profile and documents.</p></div>
    </section>
    <section className="panel"><div className="panel-body"><div className="loading-state"><span className="loading-spinner" /><strong>Loading profile details…</strong></div></div></section>
  </div>;
}
