import Pagination from './Pagination.jsx';
import RowsPerPage from './RowsPerPage.jsx';

export default function TablePagination({
  page,
  size,
  totalPages,
  totalElements,
  pageSize,
  onPage,
  onPageSize
}) {
  const start = totalElements ? page * size + 1 : 0;
  const end = Math.min((page + 1) * size, totalElements);

  return (
    <div className="table-footer">
      <span>Showing {start}&ndash;{end} of {totalElements} records</span>
      <RowsPerPage value={pageSize} onChange={onPageSize} />
      <Pagination page={page} totalPages={totalPages} onPage={onPage} />
    </div>
  );
}
