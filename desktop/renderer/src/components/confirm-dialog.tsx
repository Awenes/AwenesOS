import { useEffect, useRef } from "react";
import type { ConfirmRequest } from "../hooks/use-confirm";

export function ConfirmDialog({
  request,
  decide,
}: {
  request: ConfirmRequest | null;
  decide: (value: boolean) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!request) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") decide(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [request]);
  if (!request) return null;
  return (
    <div className="confirm-overlay" onClick={() => decide(false)}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-message"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="confirm-dialog-message">{request.message}</p>
        <div className="form-actions">
          <button type="button" className="ghost" ref={cancelRef} onClick={() => decide(false)}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={() => decide(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
