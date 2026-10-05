const pageSizeOptions = [5, 10, 20, 50];

export default function RowsPerPage({ value, onChange }) {
  return (
    <label className="rows-per-page">
      <span>Lines per page:</span>
      <select
        aria-label="Lines per page"
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
