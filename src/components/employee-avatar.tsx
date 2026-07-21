"use client";

import { useEffect, useState } from "react";
import { employeeInitials } from "@/lib/employee-avatar";

export function EmployeeAvatar({
  fullName,
  photoUrl,
  size = "small"
}: {
  fullName: string;
  photoUrl?: string | null;
  size?: "small" | "large";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [photoUrl]);

  return (
    <span className={`employee-avatar employee-avatar-${size}`} aria-label={`${fullName} profile photo`} role="img">
      <span className="employee-avatar-fallback" aria-hidden="true">{employeeInitials(fullName)}</span>
      {photoUrl && !failed ? (
        // Signed Supabase URLs expire; using the source directly avoids stale image-optimizer cache entries.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" onError={() => setFailed(true)} src={photoUrl} />
      ) : null}
    </span>
  );
}
