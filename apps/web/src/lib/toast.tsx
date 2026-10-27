import { CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <CircleCheck size={18} aria-hidden="true" />
            <p>{toast.message}</p>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
