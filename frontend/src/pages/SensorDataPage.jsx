import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import MessageBar from '../components/MessageBar.jsx';
import TablePagination from '../components/TablePagination.jsx';
import { formatDate, getErrorMessage, sensorValue, timeFilterToRange } from '../utils.js';

const DEFAULT_PAGE_SIZE = 10;
const EMPTY_FILTERS = { filterBy: '', query: '' };
const EMPTY_PAGE = {
  content: [],
  page: 0,
  totalPages: 0,
  totalElements: 0,
  size: DEFAULT_PAGE_SIZE
};

function resolveFilters(filters) {
  const query = filters.query.trim();
  const isTimeQuery = filters.filterBy === 'time'
    || (filters.filterBy === '' && /^\d{4}(?:-|\s|$)/.test(query));

  return {
    sensorId: filters.filterBy.startsWith('sensor:')
      ? filters.filterBy.slice('sensor:'.length)
      : undefined,
    time: isTimeQuery ? query : '',
    value: query && !isTimeQuery ? query : undefined
  };
}

export default function SensorDataPage() {
  const [sensors, setSensors] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState(EMPTY_PAGE);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async (page, nextFilters, size) => {
    try {
      setError('');
      const resolved = resolveFilters(nextFilters);
      const timeRange = timeFilterToRange(resolved.time);
      const { data: response } = await api.get('/sensor-data/history', {
        params: {
          sensorId: resolved.sensorId,
          from: timeRange.from,
          toExclusive: timeRange.toExclusive,
          value: resolved.value,
          page,
          size,
          sort: 'id,desc'
        }
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Cannot load sensor history.'));
    }
  }, []);

  useEffect(() => {
    api.get('/sensor-data/sensors')
      .then(({ data: response }) => setSensors(response))
      .catch((requestError) => {
        setError(getErrorMessage(requestError, 'Cannot load sensor list.'));
      });
  }, []);

  useEffect(() => {
    loadHistory(0, EMPTY_FILTERS, DEFAULT_PAGE_SIZE);
  }, [loadHistory]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const search = () => {
    setAppliedFilters(filters);
    loadHistory(0, filters, pageSize);
  };

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    loadHistory(0, EMPTY_FILTERS, pageSize);
  };

  const changePageSize = (size) => {
    setPageSize(size);
    loadHistory(0, appliedFilters, size);
  };

  const timeMode = filters.filterBy === 'time';

  return (
    <>
      <MessageBar message={error} type="error" onClose={() => setError('')} />

      <section className="filter-panel sensor-filter">
        <div className="filter-field">
          <label className="sr-only" htmlFor="sensor-filter-type">FILTER BY</label>
          <select
            id="sensor-filter-type"
            value={filters.filterBy}
            onChange={(event) => updateFilter('filterBy', event.target.value)}
          >
            <option value="">All Sensors</option>
            {sensors.map((sensor) => (
              <option key={sensor.id} value={`sensor:${sensor.id}`}>
                {sensor.name}
              </option>
            ))}
            <option value="time">Time</option>
          </select>
        </div>

        <div className="filter-field value-field">
          <label htmlFor="sensor-filter-query">VALUE</label>
          <input
            id="sensor-filter-query"
            type="text"
            inputMode={timeMode ? 'numeric' : 'decimal'}
            className={timeMode ? 'mono' : undefined}
            placeholder={timeMode ? 'YYYY-MM-DD HH:mm:ss' : ''}
            value={filters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') search();
            }}
          />
        </div>

        <div className="filter-spacer" />

        <div className="filter-actions">
          <button className="btn primary" onClick={search}>Search</button>
          <button className="btn secondary" onClick={reset}>Reset</button>
        </div>
      </section>

      <div className="table-wrap history-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>SENSOR TYPE</th>
              <th>VALUE</th>
              <th>TIME</th>
            </tr>
          </thead>
          <tbody>
            {data.content.map((row) => (
              <tr key={row.id}>
                <td className="mono">{row.id}</td>
                <td>{row.sensorName}</td>
                <td className="value-strong mono">{sensorValue(row.sensorName, row.value)}</td>
                <td className="mono muted">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
            {!data.content.length && (
              <tr>
                <td colSpan="4" className="empty-row">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={data.page}
        size={data.size}
        totalPages={data.totalPages}
        totalElements={data.totalElements}
        pageSize={pageSize}
        onPage={(page) => loadHistory(page, appliedFilters, pageSize)}
        onPageSize={changePageSize}
      />
    </>
  );
}
