import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import MessageBar from '../components/MessageBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import TablePagination from '../components/TablePagination.jsx';
import TimeFilterField from '../components/TimeFilterField.jsx';
import { getErrorMessage, formatDate, timeFilterToRange } from '../utils.js';

const DEFAULT_PAGE_SIZE = 10;
const EMPTY_FILTERS = { deviceId: '', time: '', action: '', status: '' };
const EMPTY_PAGE = {
  content: [],
  page: 0,
  totalPages: 0,
  totalElements: 0,
  size: DEFAULT_PAGE_SIZE
};

export default function DeviceHistoryPage() {
  const [devices, setDevices] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState(EMPTY_PAGE);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async (page, nextFilters, size) => {
    try {
      setError('');
      const timeRange = timeFilterToRange(nextFilters.time);
      const { data: response } = await api.get('/devices/action-history', {
        params: {
          deviceId: nextFilters.deviceId || undefined,
          action: nextFilters.action || undefined,
          status: nextFilters.status || undefined,
          from: timeRange.from,
          toExclusive: timeRange.toExclusive,
          page,
          size,
          sort: 'id,desc'
        }
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Cannot load device history.'));
    }
  }, []);

  useEffect(() => {
    api.get('/devices')
      .then(({ data: response }) => setDevices(response))
      .catch((requestError) => {
        setError(getErrorMessage(requestError, 'Cannot load device list.'));
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

  const userName = (row) => row.userName
    || row.username
    || (row.userId ? `User ${row.userId}` : '\u2014');

  return (
    <>
      <MessageBar message={error} type="error" onClose={() => setError('')} />

      <section className="filter-panel history-filter">
        <div className="filter-field">
          <label htmlFor="history-device">DEVICE</label>
          <select
            id="history-device"
            value={filters.deviceId}
            onChange={(event) => updateFilter('deviceId', event.target.value)}
          >
            <option value="">All Devices</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name || `Device ${device.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field compact-select">
          <label htmlFor="history-action">ACTION</label>
          <select
            id="history-action"
            value={filters.action}
            onChange={(event) => updateFilter('action', event.target.value)}
          >
            <option value="">All Actions</option>
            <option value="ON">ON</option>
            <option value="OFF">OFF</option>
          </select>
        </div>

        <div className="filter-field compact-select">
          <label htmlFor="history-status">STATUS</label>
          <select
            id="history-status"
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
          >
            <option value="">All Status</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>

        <div className="filter-spacer" />

        <div className="filter-field time-field">
          <label>TIME</label>
          <TimeFilterField
            value={filters.time}
            onChange={(time) => updateFilter('time', time)}
            onSearch={search}
          />
        </div>

        <div className="filter-actions">
          <button className="btn primary" onClick={search}>Search</button>
          <button className="btn secondary" onClick={reset}>Reset</button>
        </div>
      </section>

      <div className="table-wrap history-table-wrap">
        <table className="data-table history-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>DEVICE</th>
              <th>ACTION</th>
              <th>STATUS</th>
              <th>USER NAME</th>
              <th>TIME</th>
            </tr>
          </thead>
          <tbody>
            {data.content.map((row) => (
              <tr key={row.id}>
                <td className="mono">{row.id}</td>
                <td className="mono">{row.deviceName || `Device ${row.deviceId}`}</td>
                <td className="value-strong">{row.action}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{userName(row)}</td>
                <td className="mono muted">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
            {!data.content.length && (
              <tr>
                <td colSpan="6" className="empty-row">No records found.</td>
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
