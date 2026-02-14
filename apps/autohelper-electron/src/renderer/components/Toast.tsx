import type { Toast as ToastType } from "../hooks/useToast";

interface ToastProps {
  toasts: ToastType[];
}

export function Toast({ toasts }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast visible ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
