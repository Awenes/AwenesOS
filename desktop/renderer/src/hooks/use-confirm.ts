import { useCallback, useRef, useState } from "react";

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
}

export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (message: string, confirmLabel = "Continue") =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setRequest({ message, confirmLabel });
      }),
    [],
  );

  function decide(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }

  return { confirm, request, decide };
}
