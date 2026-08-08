"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { HrmsAuthClientContext } from "@/lib/auth";

function AppShellLayoutInner({ auth, children }: { auth: HrmsAuthClientContext; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [pending, setPending] = useState(false);

  useEffect(() => setPending(false), [routeKey]);

  useEffect(() => {
    const clearPending = () => setPending(false);
    window.addEventListener("hashchange", clearPending);
    return () => window.removeEventListener("hashchange", clearPending);
  }, []);

  useEffect(() => {
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const current = new URL(window.location.href);
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== current.origin) return;
      if (destination.pathname === current.pathname && destination.search === current.search) return;
      setPending(true);
    };
    const submit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.target && form.target !== "_self") return;
      const method = form.getAttribute("method")?.toLowerCase();
      if (method !== "get") return;
      setPending(true);
    };
    document.addEventListener("click", start, true);
    document.addEventListener("submit", submit, true);
    return () => {
      document.removeEventListener("click", start, true);
      document.removeEventListener("submit", submit, true);
    };
  }, []);

  return <AppShell auth={auth} contentPending={pending}>{children}</AppShell>;
}

export function AppShellLayout({ auth, children }: { auth: HrmsAuthClientContext; children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShell auth={auth} contentPending={false}>{null}</AppShell>}>
      <AppShellLayoutInner auth={auth}>{children}</AppShellLayoutInner>
    </Suspense>
  );
}
