import type { KeyboardEvent } from "react";

/** Enter-to-send; skip while IME is composing (avoids duplicate sends on Telex/VNI/macOS). */
export function shouldSendOnEnterKey(e: KeyboardEvent<HTMLElement>): boolean {
  if (e.key !== "Enter" || e.shiftKey) return false;
  const native = e.nativeEvent;
  if (native.isComposing || native.keyCode === 229) return false;
  return true;
}

/** Debounced send lock — WS path completes sync so finally must not unlock immediately. */
export function acquireSendLock(
  lockRef: { current: boolean },
  lastSentRef: { current: { text: string; at: number } | null },
  text: string,
  windowMs = 500,
): boolean {
  if (lockRef.current) return false;
  const now = Date.now();
  const last = lastSentRef.current;
  if (last && last.text === text && now - last.at < windowMs) {
    return false;
  }
  lockRef.current = true;
  lastSentRef.current = { text, at: now };
  return true;
}

export function releaseSendLock(lockRef: { current: boolean }, delayMs = 400) {
  window.setTimeout(() => {
    lockRef.current = false;
  }, delayMs);
}
