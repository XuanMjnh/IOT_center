export default function MessageBar({ message, type = 'info', onClose }) {
  if (!message) return null;

  return (
    <div className={`message-bar ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss message">
          &times;
        </button>
      )}
    </div>
  );
}
