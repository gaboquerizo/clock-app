function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalClockTime(timestamp: number): string {
  const date = new Date(timestamp);

  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(padTimePart)
    .join(':');
}
