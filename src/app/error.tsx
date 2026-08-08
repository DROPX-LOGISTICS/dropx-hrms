"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-copy">Something went wrong.</p>
        <p className="fine-print">{error.message || "Unexpected application error."}</p>
        {error.digest ? <p className="fine-print">Digest: {error.digest}</p> : null}
        <p className="fine-print">
          <button type="button" className="link-button" onClick={() => reset()}>Try again</button>
          {" · "}
          <a href="/auth/signout">Sign out</a>
        </p>
      </section>
    </main>
  );
}
