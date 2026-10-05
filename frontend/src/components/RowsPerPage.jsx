const pageSizeOptions = [5, 10, 20, 50];

export default function RowsPerPage({ value, onChange }) {
  return (
    <label className="rows-per-page">
      <span>Số dòng</span>
      <select
        aria-label="Số dòng hiển thị"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {pageSizeOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
