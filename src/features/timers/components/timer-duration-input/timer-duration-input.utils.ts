export type TimerDurationFields = {
  hours: string;
  minutes: string;
  seconds: string;
};

export type TimerDurationField = keyof TimerDurationFields;

export type TimerDurationErrorCode =
  | 'invalid-format'
  | 'hours-out-of-range'
  | 'minutes-out-of-range'
  | 'seconds-out-of-range'
  | 'zero-duration';

export type TimerDurationValidation =
  | { ok: true; durationMs: number }
  | {
      ok: false;
      code: TimerDurationErrorCode;
      field?: TimerDurationField;
      message: string;
    };

export const MAX_TIMER_DURATION_MS =
  (99 * 60 * 60 + 59 * 60 + 59) * 1_000;

export function formatTimerDurationField(value: number): string {
  return String(value).padStart(2, '0');
}

export function getTimerDurationFields(
  durationMs: number | undefined,
): TimerDurationFields {
  if (
    durationMs === undefined ||
    !Number.isSafeInteger(durationMs) ||
    durationMs < 0 ||
    durationMs > MAX_TIMER_DURATION_MS
  ) {
    return { hours: '00', minutes: '00', seconds: '00' };
  }

  const totalSeconds = Math.floor(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: formatTimerDurationField(hours),
    minutes: formatTimerDurationField(minutes),
    seconds: formatTimerDurationField(seconds),
  };
}

function parseField(
  field: TimerDurationField,
  value: string,
): { ok: true; value: number } | Extract<TimerDurationValidation, { ok: false }> {
  if (!/^\d{1,2}$/.test(value)) {
    return {
      ok: false,
      code: 'invalid-format',
      field,
      message: 'Introduce un valor numérico de hasta dos dígitos.',
    };
  }

  const parsed = Number(value);
  const maximum = field === 'hours' ? 99 : 59;

  if (parsed > maximum) {
    const messages: Record<
      Exclude<TimerDurationField, 'hours'> | 'hours',
      string
    > = {
      hours: 'Las horas deben estar entre 00 y 99.',
      minutes: 'Los minutos deben estar entre 00 y 59.',
      seconds: 'Los segundos deben estar entre 00 y 59.',
    };

    return {
      ok: false,
      code: `${field}-out-of-range`,
      field,
      message: messages[field],
    };
  }

  return { ok: true, value: parsed };
}

export function parseTimerDuration(
  fields: TimerDurationFields,
): TimerDurationValidation {
  const hours = parseField('hours', fields.hours);
  if (!hours.ok) return hours;

  const minutes = parseField('minutes', fields.minutes);
  if (!minutes.ok) return minutes;

  const seconds = parseField('seconds', fields.seconds);
  if (!seconds.ok) return seconds;

  const durationMs =
    (hours.value * 3_600 + minutes.value * 60 + seconds.value) * 1_000;

  if (durationMs === 0) {
    return {
      ok: false,
      code: 'zero-duration',
      message: 'La duración debe ser mayor que cero.',
    };
  }

  return { ok: true, durationMs };
}
