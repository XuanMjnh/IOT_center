export default function Pagination({ page, totalPages, onPage }) {
  if (!totalPages) return null;

  const current = page + 1;
  const start = Math.max(1, Math.min(current - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  return (
    <nav className="pagination" aria-label="Table pagination">
      <button type="button" disabled={!page} onClick={() => onPage(page - 1)} aria-label="Previous page">&lt;</button>
      {pages.map((number) => (
        <button
          type="button"
          key={number}
          className={number === current ? 'active' : ''}
          aria-current={number === current ? 'page' : undefined}
          onClick={() => onPage(number - 1)}
        >
          {number}
        </button>
      ))}
      <button type="button" disabled={current >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">&gt;</button>
    </nav>
  );
}
