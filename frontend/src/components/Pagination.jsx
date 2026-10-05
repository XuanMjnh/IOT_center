export default function Pagination({ page, totalPages, onPage }) {
  if (!totalPages) return null;

  const current = page + 1;
  let start = Math.max(1, current - 2);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);

  const pages = [];
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }

  return (
    <nav className="pagination" aria-label="Table pagination">
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        &lt;
      </button>

      {pages.map((pageNumber) => (
        <button
          type="button"
          key={pageNumber}
          className={pageNumber === current ? 'active' : ''}
          aria-current={pageNumber === current ? 'page' : undefined}
          onClick={() => onPage(pageNumber - 1)}
        >
          {pageNumber}
        </button>
      ))}

      <button
        type="button"
        disabled={current >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        &gt;
      </button>
    </nav>
  );
}
