export function formatStopwatchElapsed(elapsedMs: number): string {
  const totalCentiseconds = Math.floor(elapsedMs / 10);
  const hours = Math.floor(totalCentiseconds / 360_000);
  const minutes = Math.floor(totalCentiseconds / 6_000) % 60;
  const seconds = Math.floor(totalCentiseconds / 100) % 60;
  const centiseconds = totalCentiseconds % 100;
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}
