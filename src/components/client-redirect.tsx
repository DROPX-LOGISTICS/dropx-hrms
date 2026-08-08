"use client";

import { useEffect } from "react";

/** Same-origin navigation that works on Cloudflare Workers when next/navigation redirect() 500s. */
export function ClientRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-copy">Redirecting…</p>
        <p className="fine-print"><a href={href}>Continue</a></p>
      </section>
    </main>
  );
}
