export const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function sensorValue(name, value) {
  const formats = {
    temperature: [1, ' °C'],
    humidity: [0, ' %'],
    light: [0, ' lux']
  };
  const [digits, unit] = formats[String(name).toLowerCase()] || [null, ''];
  return digits === null ? String(value) : `${Number(value).toFixed(digits)}${unit}`;
}

export function timeFilterToRange(value) {
  const text = String(value || '').trim();
  if (!text) return {};

  const parts = text.replace(/[ T]/, '-').replaceAll(':', '-').split('-').map(Number);
  const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0] = parts;
  const start = new Date(year, month - 1, day, hour, minute, second);
  const end = new Date(start);
  const units = ['FullYear', 'Month', 'Date', 'Hours', 'Minutes', 'Seconds'];
  const unit = units[parts.length - 1];
  end[`set${unit}`](end[`get${unit}`]() + 1);

  return { from: start.toISOString(), toExclusive: end.toISOString() };
}
