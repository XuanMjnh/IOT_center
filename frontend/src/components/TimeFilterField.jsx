export default function TimeFilterField({ value, onChange, onSearch }) {
  return (
    <input
      className="time-filter-input mono"
      type="text"
      inputMode="numeric"
      placeholder="YYYY-MM-DD HH:mm:ss"
      aria-label="Time"
      title="Enter from YYYY up to YYYY-MM-DD HH:mm:ss"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSearch?.();
      }}
    />
  );
}
