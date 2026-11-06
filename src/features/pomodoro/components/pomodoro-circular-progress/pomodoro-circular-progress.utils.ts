export function getPomodoroRemainingRatio(
  durationMs: number,
  remainingMs: number,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 0;
  }

  const safeRemainingMs = Number.isFinite(remainingMs)
    ? Math.max(0, remainingMs)
    : 0;

  return Math.min(1, safeRemainingMs / durationMs);
}
