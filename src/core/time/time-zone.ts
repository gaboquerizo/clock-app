function padOffsetPart(value: number): string {
  return String(value).padStart(2, '0');
}

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export function formatLocalGmtOffset(timestamp: number): string {
  const offsetMinutes = -new Date(timestamp).getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteOffsetMinutes / 60);
  const minutes = absoluteOffsetMinutes % 60;

  return minutes === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${padOffsetPart(minutes)}`;
}
