export default function Loading() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span aria-hidden="true" className="loading-spinner route-loading-spinner" />
      <strong>Loading DropX People…</strong>
      <span>Please wait while we prepare this page.</span>
    </main>
  );
}
