import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/Dialog";
import styles from "./index.module.css";

export type ConfirmTone = "default" | "danger";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const finish = useCallback((result: boolean) => {
    setOpen(false);
    setOptions(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(next);
      setOpen(true);
    });
  }, []);

  const tone = options?.tone ?? "default";
  const confirmLabel = options?.confirmLabel ?? "Confirm";
  const cancelLabel = options?.cancelLabel ?? "Cancel";

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={open} onClose={() => finish(false)} title={options?.title ?? ""}>
        {options?.description ? <p className={styles.description}>{options.description}</p> : null}
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.cancel}`} onClick={() => finish(false)}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${tone === "danger" ? styles.confirmDanger : styles.confirm}`}
            onClick={() => finish(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogContextValue {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return ctx;
}
