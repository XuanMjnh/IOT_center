export function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value.includes?.('T') ? value : String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function sensorValue(name, value) {
  const num = Number(value);
  const n = Number.isFinite(num) ? num : value;
  const key = String(name || '').toLowerCase();
  if (key === 'temperature') return `${Number(n).toFixed(1)} °C`;
  if (key === 'humidity') return `${Number(n).toFixed(0)} %`;
  if (key === 'light') return `${Number(n).toFixed(0)} lux`;
  return String(n);
}

// Turns a partial local wall-clock value into a half-open range. The omitted
// parts determine whether the range covers a year, month, day, hour, minute,
// or second.
export function timeFilterToRange(value) {
  const input = String(value || '').trim();
  if (!input) return {};

  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[ T](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?)?)?$/.exec(input);
  if (!match) {
    throw new Error('Time must use a format from YYYY up to YYYY-MM-DD HH:mm:ss.');
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const parts = [yearText, monthText || '1', dayText || '1', hourText || '0', minuteText || '0', secondText || '0'].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const start = new Date(year, month - 1, day, hour, minute, second, 0);

  if (
    start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day ||
    start.getHours() !== hour || start.getMinutes() !== minute || start.getSeconds() !== second
  ) {
    throw new Error('Time is not a valid calendar date and time.');
  }

  const end = new Date(start);
  if (secondText !== undefined) end.setSeconds(end.getSeconds() + 1);
  else if (minuteText !== undefined) end.setMinutes(end.getMinutes() + 1);
  else if (hourText !== undefined) end.setHours(end.getHours() + 1);
  else if (dayText !== undefined) end.setDate(end.getDate() + 1);
  else if (monthText !== undefined) end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);

  return { from: start.toISOString(), toExclusive: end.toISOString() };
}
