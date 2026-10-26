import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle } from './Icons.jsx';

let toastTrigger = null;

export function notify(message, type = 'success', duration = 3500) {
  if (toastTrigger) {
    toastTrigger(message, type, duration);
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastTrigger = (message, type, duration) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };
    return () => {
      toastTrigger = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <CheckCircle2 size={18} color="var(--success-color)" />}
          {t.type === 'error' && <AlertCircle size={18} color="var(--danger-color)" />}
          {t.type === 'warning' && <AlertTriangle size={18} color="var(--warning-color)" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
