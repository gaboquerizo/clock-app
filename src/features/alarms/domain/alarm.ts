import {
  hasDuplicateAlarmId,
  hasDuplicateAlarmTime,
  isValidTimestamp,
  validateCreateAlarmInput,
} from './alarm.rules';
import type {
  Alarm,
  AlarmResult,
  AlarmTransition,
  CreateAlarmInput,
} from './alarm.types';

function failure<T>(
  code:
    | 'duplicate-id'
    | 'duplicate-time'
    | 'invalid-transition'
    | 'invalid-timestamp',
): AlarmResult<T> {
  return { ok: false, error: { code } };
}

export function createAlarm(
  input: CreateAlarmInput,
  existingAlarms: readonly Alarm[] = [],
): AlarmResult<Alarm> {
  const validatedInput = validateCreateAlarmInput(input);

  if (!validatedInput.ok) {
    return validatedInput;
  }

  if (hasDuplicateAlarmId(existingAlarms, validatedInput.value.id)) {
    return failure('duplicate-id');
  }

  if (hasDuplicateAlarmTime(existingAlarms, validatedInput.value.time)) {
    return failure('duplicate-time');
  }

  return {
    ok: true,
    value: {
      id: validatedInput.value.id,
      time: validatedInput.value.time,
      label: validatedInput.value.label,
      enabled: true,
      status: 'scheduled',
      order: validatedInput.value.order,
      createdAt: validatedInput.value.createdAt,
      updatedAt: validatedInput.value.createdAt,
    },
  };
}

export function canTransitionAlarm(
  alarm: Alarm,
  transition: AlarmTransition,
): boolean {
  if (alarm.status !== 'scheduled') {
    return false;
  }

  if (transition === 'enable') {
    return !alarm.enabled;
  }

  if (transition === 'disable') {
    return alarm.enabled;
  }

  return alarm.enabled && (transition === 'trigger' || transition === 'skip');
}

export function transitionAlarm(
  alarm: Alarm,
  transition: AlarmTransition,
  timestamp: number,
): AlarmResult<Alarm> {
  if (!isValidTimestamp(timestamp) || timestamp < alarm.updatedAt) {
    return failure('invalid-timestamp');
  }

  if (!canTransitionAlarm(alarm, transition)) {
    return failure('invalid-transition');
  }

  if (transition === 'enable') {
    return {
      ok: true,
      value: { ...alarm, enabled: true, updatedAt: timestamp },
    };
  }

  if (transition === 'disable') {
    return {
      ok: true,
      value: { ...alarm, enabled: false, updatedAt: timestamp },
    };
  }

  if (transition === 'trigger') {
    return {
      ok: true,
      value: {
        ...alarm,
        enabled: false,
        status: 'triggered',
        triggeredAt: timestamp,
        updatedAt: timestamp,
      },
    };
  }

  return {
    ok: true,
    value: {
      ...alarm,
      enabled: false,
      status: 'skipped',
      skippedAt: timestamp,
      updatedAt: timestamp,
    },
  };
}
