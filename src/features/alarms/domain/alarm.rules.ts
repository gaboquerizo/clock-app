import type {
  Alarm,
  AlarmDomainError,
  AlarmId,
  AlarmLabel,
  AlarmResult,
  AlarmTime,
  CreateAlarmInput,
} from './alarm.types';

export const MAX_ALARM_LABEL_LENGTH = 100;

const alarmTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const controlCharacterPattern = /[\u0000-\u001F\u007F]/u;

function success<T>(value: T): AlarmResult<T> {
  return { ok: true, value };
}

function failure<T>(error: AlarmDomainError): AlarmResult<T> {
  return { ok: false, error };
}

export function isValidAlarmTime(value: unknown): value is AlarmTime {
  return typeof value === 'string' && alarmTimePattern.test(value);
}

export function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalizeAlarmLabel(label?: string): AlarmResult<AlarmLabel> {
  const normalizedLabel = label?.trim() ?? '';

  if (
    Array.from(normalizedLabel).length > MAX_ALARM_LABEL_LENGTH ||
    controlCharacterPattern.test(normalizedLabel)
  ) {
    return failure({ code: 'invalid-label', field: 'label' });
  }

  return success(normalizedLabel);
}

export function validateCreateAlarmInput(
  input: CreateAlarmInput,
): AlarmResult<{
  id: string;
  time: AlarmTime;
  label: AlarmLabel;
  createdAt: number;
}> {
  const normalizedId = input.id.trim();

  if (normalizedId.length === 0) {
    return failure({ code: 'invalid-id', field: 'id' });
  }

  if (!isValidAlarmTime(input.time)) {
    return failure({ code: 'invalid-time', field: 'time' });
  }

  if (!isValidTimestamp(input.createdAt)) {
    return failure({ code: 'invalid-timestamp', field: 'createdAt' });
  }

  const label = normalizeAlarmLabel(input.label);

  if (!label.ok) {
    return label;
  }

  return success({
    id: normalizedId,
    time: input.time,
    label: label.value,
    createdAt: input.createdAt,
  });
}

export function hasDuplicateAlarmId(
  alarms: readonly Alarm[],
  id: string,
): boolean {
  return alarms.some((alarm) => alarm.id === id);
}

export function hasDuplicateAlarmTime(
  alarms: readonly Alarm[],
  time: AlarmTime,
  excludedId?: AlarmId,
): boolean {
  return alarms.some(
    (alarm) => alarm.id !== excludedId && alarm.time === time,
  );
}
