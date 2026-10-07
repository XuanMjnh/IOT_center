import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import MessageBar from '../components/MessageBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import TablePagination from '../components/TablePagination.jsx';
import TimeFilterField from '../components/TimeFilterField.jsx';
import { formatDate, getErrorMessage, timeFilterToRange } from '../utils.js';

const PAGE_SIZE = 10;
const EMPTY_FILTERS = { deviceId: '', time: '', action: '', status: '' };

export default function DeviceHistoryPage() {
  const [devices, setDevices] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [data, setData] = useState({ content: [], page: 0, size: PAGE_SIZE, totalPages: 0, totalElements: 0 });
  const [error, setError] = useState('');

  const loadHistory = async (page, nextFilters, size) => {
    try {
      const { time, ...filters } = nextFilters;
      const response = await api.get('/devices/action-history', {
        params: { ...filters, ...timeFilterToRange(time), page, size }
      });
      setData(response.data);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Cannot load device history.'));
    }
  };

  useEffect(() => {
    api.get('/devices')
      .then(({ data }) => setDevices(data))
      .catch((e) => setError(getErrorMessage(e, 'Cannot load device list.')));
    loadHistory(0, EMPTY_FILTERS, PAGE_SIZE);
  }, []);

  const updateFilter = (name, value) => setFilters({ ...filters, [name]: value });
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

  return (
    <>
      <MessageBar message={error} type="error" onClose={() => setError('')} />

      <section className="filter-panel history-filter">
        <div className="filter-field">
          <label htmlFor="history-device">DEVICE</label>
          <select id="history-device" value={filters.deviceId} onChange={(e) => updateFilter('deviceId', e.target.value)}>
            <option value="">All Devices</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>{device.name || `Device ${device.id}`}</option>
            ))}
          </select>
        </div>

        <div className="filter-field compact-select">
          <label htmlFor="history-action">ACTION</label>
          <select id="history-action" value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}>
            <option value="">All Actions</option>
            <option value="ON">ON</option>
            <option value="OFF">OFF</option>
          </select>
        </div>

        <div className="filter-field compact-select">
          <label htmlFor="history-status">STATUS</label>
          <select id="history-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">All Status</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>

        <div className="filter-spacer" />
        <div className="filter-field time-field">
          <label>TIME</label>
          <TimeFilterField value={filters.time} onChange={(time) => updateFilter('time', time)} onSearch={search} />
        </div>

        <div className="filter-actions">
          <button className="btn primary" onClick={search}>Search</button>
          <button className="btn secondary" onClick={reset}>Reset</button>
        </div>
      </section>

      <div className="table-wrap history-table-wrap">
        <table className="data-table history-table">
          <thead>
            <tr><th>ID</th><th>DEVICE</th><th>ACTION</th><th>STATUS</th><th>USER NAME</th><th>TIME</th></tr>
          </thead>
          <tbody>
            {data.content.map((row) => (
              <tr key={row.id}>
                <td className="mono">{row.id}</td>
                <td className="mono">{row.deviceName || `Device ${row.deviceId}`}</td>
                <td className="value-strong">{row.action}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{row.userName || row.username || `User ${row.userId}`}</td>
                <td className="mono muted">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
            {!data.content.length && (
              <tr><td colSpan="6" className="empty-row">No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        {...data}
        pageSize={pageSize}
        onPage={(page) => loadHistory(page, appliedFilters, pageSize)}
        onPageSize={changePageSize}
      />
    </>
  );
}
