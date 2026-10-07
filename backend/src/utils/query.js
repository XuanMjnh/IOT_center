export function pagination(query) {
  const page = Math.max(0, Number(query.page) || 0);
  const size = Math.min(100, Math.max(1, Number(query.size) || 10));
  return { page, size, offset: page * size };
}

export function sqlDate(value) {
  return value ? new Date(value).toISOString().slice(0, 19).replace('T', ' ') : null;
}

export function where(filters) {
  const active = filters.filter(([, value]) => value !== undefined && value !== null && value !== '');
  return {
    sql: active.length ? `WHERE ${active.map(([clause]) => clause).join(' AND ')}` : '',
    params: active.map(([, value]) => value)
  };
}
