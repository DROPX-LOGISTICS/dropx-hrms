import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function buildHref(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">Page {page} of {totalPages} · {total} total</span>
      <div className="pagination-controls">
        {hasPrev ? <Link className="button secondary small" href={buildHref(page - 1)}>Previous</Link> : <span className="button secondary small disabled" aria-disabled="true">Previous</span>}
        {hasNext ? <Link className="button secondary small" href={buildHref(page + 1)}>Next</Link> : <span className="button secondary small disabled" aria-disabled="true">Next</span>}
      </div>
    </nav>
  );
}
