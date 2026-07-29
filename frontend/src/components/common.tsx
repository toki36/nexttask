import { useEffect, useId, useRef, type ReactNode } from "react";

export function StatusMessage({ status, error }: { status: string; error: string }) {
  if (!status && !error) return null;
  if (error) return <p className="status-line error" role="alert">{error}</p>;
  return <p className="status-line" aria-live="polite">{status}</p>;
}

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "small" | "medium";
};

export function Modal({ title, children, onClose, size = "medium" }: ModalProps) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleID = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const initialFocus =
      panel?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ??
      panel?.querySelector<HTMLElement>(focusableSelector);
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-modal="true"
        className={`modal-panel ${size}`}
        role="dialog"
        aria-labelledby={titleID}
        ref={panelRef}
      >
        <div className="modal-header">
          <h2 id={titleID}>{title}</h2>
          <button aria-label="Close" className="modal-close" onClick={onClose} title="Close" type="button">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
