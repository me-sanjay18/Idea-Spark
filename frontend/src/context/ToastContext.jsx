import { CheckCircle2, Info, AlertTriangle, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (type, message, title = '') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, message, title }]);
      setTimeout(() => {
        dismiss(id);
      }, 4800);
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message, title) => pushToast('success', message, title),
      error: (message, title) => pushToast('error', message, title),
      info: (message, title) => pushToast('info', message, title),
      warning: (message, title) => pushToast('warning', message, title),
    }),
    [pushToast]
  );

  const iconMap = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />,
    info: <Info className="h-5 w-5 text-[#2057E8] shrink-0" />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-lg shadow-slate-900/10 transition-all"
          >
            {iconMap[item.type] || iconMap.info}
            <div className="flex-1 min-w-0">
              {item.title && <p className="text-sm font-semibold text-[#171717]">{item.title}</p>}
              <p className="text-sm text-slate-700 leading-snug">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

