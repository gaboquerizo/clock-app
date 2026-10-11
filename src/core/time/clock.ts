function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

const localDateFormatter = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});

export function formatLocalClockTime(timestamp: number): string {
  const date = new Date(timestamp);

  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(padTimePart)
    .join(':');
}

export function formatLocalClockDate(timestamp: number): string {
  return localDateFormatter.format(new Date(timestamp));
}

export function formatLocalDateTimeAttribute(timestamp: number): string {
  const date = new Date(timestamp);

  return [
    date.getFullYear(),
    padTimePart(date.getMonth() + 1),
    padTimePart(date.getDate()),
  ].join('-');
}
