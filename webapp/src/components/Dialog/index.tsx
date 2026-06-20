import { useEffect, type ReactNode } from "react";
import styles from "./index.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** id for aria-labelledby */
  titleId?: string;
}

export function Dialog({ open, onClose, title, children, titleId = "dialog-title" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.root} role="presentation">
      <button type="button" className={styles.backdrop} onClick={onClose} aria-label="Close dialog" />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-orbit-dialog
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>
    </div>
  );
}
