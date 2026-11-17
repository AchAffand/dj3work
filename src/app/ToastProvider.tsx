import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ToastTone = "success" | "error" | "info";
type ToastMessage = { id: number; tone: ToastTone; title: string; text: string };
type ToastContextValue = { notify: (tone: ToastTone, text: string, title?: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const notify = useCallback((tone: ToastTone, text: string, title?: string) => {
    setToast({ id: Date.now(), tone, title: title ?? (tone === "success" ? "Berhasil" : tone === "error" ? "Tidak berhasil" : "Informasi"), text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {toast && <div className={`formula-toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}>
        <span className="formula-toast-icon" aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span>
        <div className="formula-toast-copy"><strong>{toast.title}</strong><span>{toast.text}</span></div>
        <button className="formula-toast-close" type="button" aria-label="Tutup notifikasi" onClick={() => setToast(null)}>×</button>
      </div>}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast harus digunakan di dalam ToastProvider");
  return value;
}
