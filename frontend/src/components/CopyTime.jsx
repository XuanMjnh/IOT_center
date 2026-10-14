import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatDate } from '../utils.js';

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const previousFocus = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  try {
    input.select();
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    input.remove();
    previousFocus?.focus();
  }
}

export default function CopyTime({ value }) {
  const [result, setResult] = useState('');
  const [copying, setCopying] = useState(false);
  const timer = useRef(null);
  const time = formatDate(value);

  useEffect(() => {
    setResult('');
    return () => clearTimeout(timer.current);
  }, [value]);

  const copy = async () => {
    setCopying(true);
    clearTimeout(timer.current);
    try {
      await copyText(time);
      setResult('copied');
    } catch {
      setResult('error');
    } finally {
      setCopying(false);
      timer.current = setTimeout(() => setResult(''), 2000);
    }
  };

  const label = result === 'copied' ? 'Đã copy' : result === 'error' ? 'Copy thất bại, thử lại' : `Copy thời gian ${time}`;

  return (
    <span className="copy-time">
      <span>{time}</span>
      <button
        type="button"
        className={`copy-time-button ${result}`}
        onClick={copy}
        disabled={!value || copying}
        title={label}
        aria-label={label}
      >
        {result === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
      <span className={result === 'error' ? 'copy-time-error' : 'sr-only'} role="status">
        {result === 'copied' ? 'Đã copy thời gian' : result === 'error' ? 'Copy thất bại' : ''}
      </span>
    </span>
  );
}
