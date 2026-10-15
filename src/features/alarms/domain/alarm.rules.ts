/*—————————— Types ——————————*/
import type {
  Alarm,
  AlarmDomainError,
  AlarmId,
  AlarmLabel,
  AlarmResult,
  AlarmStatus,
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

export function isValidAlarmOrder(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
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
  order: number;
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

  if (!isValidAlarmOrder(input.order)) {
    return failure({ code: 'invalid-order', field: 'order' });
  }

  const label = normalizeAlarmLabel(input.label);

  if (!label.ok) {
    return label;
  }

  return success({
    id: normalizedId,
    time: input.time,
    label: label.value,
    order: input.order,
    createdAt: input.createdAt,
  });
}

function isAlarmStatus(value: unknown): value is AlarmStatus {
  return value === 'scheduled' || value === 'triggered' || value === 'skipped';
}

function isOptionalTimestamp(value: unknown): value is number | undefined {
  return value === undefined || isValidTimestamp(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateAlarm(value: unknown): AlarmResult<Alarm> {
  if (!isRecord(value)) {
    return failure({ code: 'invalid-state' });
  }

  const id = value.id;

  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    id.trim() !== id
  ) {
    return failure({ code: 'invalid-id', field: 'id' });
  }

  if (!isValidAlarmTime(value.time)) {
    return failure({ code: 'invalid-time', field: 'time' });
  }

  if (typeof value.label !== 'string') {
    return failure({ code: 'invalid-label', field: 'label' });
  }

  const label = normalizeAlarmLabel(value.label);

  if (!label.ok) {
    return label;
  }

  if (typeof value.enabled !== 'boolean') {
    return failure({ code: 'invalid-state', field: 'enabled' });
  }

  if (!isAlarmStatus(value.status)) {
    return failure({ code: 'invalid-state', field: 'status' });
  }

  if (!isValidAlarmOrder(value.order)) {
    return failure({ code: 'invalid-order', field: 'order' });
  }

  if (!isValidTimestamp(value.createdAt)) {
    return failure({ code: 'invalid-timestamp', field: 'createdAt' });
  }

  if (
    !isValidTimestamp(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) {
    return failure({ code: 'invalid-timestamp', field: 'updatedAt' });
  }

  if (!isOptionalTimestamp(value.triggeredAt)) {
    return failure({ code: 'invalid-timestamp', field: 'triggeredAt' });
  }

  if (!isOptionalTimestamp(value.skippedAt)) {
    return failure({ code: 'invalid-timestamp', field: 'skippedAt' });
  }

  const triggeredAt = value.triggeredAt;
  const skippedAt = value.skippedAt;

  if (value.status === 'scheduled') {
    if (triggeredAt !== undefined || skippedAt !== undefined) {
      return failure({ code: 'invalid-state', field: 'status' });
    }
  }

  if (value.status === 'triggered') {
    if (
      value.enabled ||
      triggeredAt === undefined ||
      skippedAt !== undefined ||
      triggeredAt < value.createdAt ||
      triggeredAt > value.updatedAt
    ) {
      return failure({ code: 'invalid-state', field: 'status' });
    }
  }

  if (value.status === 'skipped') {
    if (
      value.enabled ||
      skippedAt === undefined ||
      triggeredAt !== undefined ||
      skippedAt < value.createdAt ||
      skippedAt > value.updatedAt
    ) {
      return failure({ code: 'invalid-state', field: 'status' });
    }
  }

  return success({
    id,
    time: value.time,
    label: label.value,
    enabled: value.enabled,
    status: value.status,
    order: value.order,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(triggeredAt === undefined ? {} : { triggeredAt }),
    ...(skippedAt === undefined ? {} : { skippedAt }),
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
