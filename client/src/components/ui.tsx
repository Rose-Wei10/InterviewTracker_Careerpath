import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { errorMessage } from "../services/api";
export function Loading() {
  return (
    <div role="status" aria-label="Loading" className="skeleton">
      <span />
      <span />
      <span />
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error">
      {errorMessage(error)}{" "}
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Modal({
  title,
  children,
  onClose,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={compact ? "dialog-compact" : undefined}
      onCancel={onClose}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose} compact>
      <p>This cannot be undone.</p>
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button className="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
