export function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill ${normalized}`}>{value}</span>;
}
