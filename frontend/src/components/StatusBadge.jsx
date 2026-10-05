export default function StatusBadge({ status }) {
  return <span className={`status-badge ${String(status || '').toLowerCase()}`}>{status}</span>;
}
