/*—————————— Functions ——————————*/
import {
  hasDuplicateAlarmId,
  hasDuplicateAlarmTime,
  isValidAlarmTime,
  isValidTimestamp,
  normalizeAlarmLabel,
  validateCreateAlarmInput,
} from './alarm.rules';
import {
  getNextAlarmActivationAt,
  scheduleAlarm,
} from './alarm-scheduling';

/*—————————— Types ——————————*/
import type {
  Alarm,
  AlarmResult,
  AlarmTransition,
  CreateAlarmInput,
  UpdateAlarmInput,
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

  const nextActivation = getNextAlarmActivationAt(
    validatedInput.value.time,
    validatedInput.value.createdAt,
  );

  if (!nextActivation.ok) {
    return { ok: false, error: nextActivation.error };
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
      nextActivationAt: nextActivation.value,
    },
  };
}

export function updateAlarm(
  alarm: Alarm,
  input: UpdateAlarmInput,
  existingAlarms: readonly Alarm[],
  timestamp: number,
): AlarmResult<Alarm> {
  if (!isValidTimestamp(timestamp) || timestamp < alarm.updatedAt) {
    return failure('invalid-timestamp');
  }

  if (alarm.status !== 'scheduled') {
    return failure('invalid-transition');
  }

  if (!isValidAlarmTime(input.time)) {
    return {
      ok: false,
      error: { code: 'invalid-time', field: 'time' },
    };
  }

  const label = normalizeAlarmLabel(input.label ?? alarm.label);

  if (!label.ok) {
    return label;
  }

  if (hasDuplicateAlarmTime(existingAlarms, input.time, alarm.id)) {
    return failure('duplicate-time');
  }

  let nextActivationAt = alarm.nextActivationAt;

  if (!alarm.enabled) {
    nextActivationAt = undefined;
  } else if (input.time !== alarm.time || nextActivationAt === undefined) {
    const nextActivation = getNextAlarmActivationAt(input.time, timestamp);

    if (!nextActivation.ok) {
      return { ok: false, error: nextActivation.error };
    }

    nextActivationAt = nextActivation.value;
  }

  return {
    ok: true,
    value: {
      ...alarm,
      time: input.time,
      label: label.value,
      updatedAt: timestamp,
      nextActivationAt,
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
    const scheduledAlarm = scheduleAlarm(
      { ...alarm, enabled: true },
      timestamp,
    );

    if (!scheduledAlarm.ok) {
      return scheduledAlarm;
    }

    return scheduledAlarm;
  }

  if (transition === 'disable') {
    return {
      ok: true,
      value: {
        ...alarm,
        enabled: false,
        nextActivationAt: undefined,
        updatedAt: timestamp,
      },
    };
  }

  if (transition === 'trigger') {
    return {
      ok: true,
      value: {
        ...alarm,
        enabled: false,
        status: 'triggered',
        nextActivationAt: undefined,
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
      nextActivationAt: undefined,
      skippedAt: timestamp,
      updatedAt: timestamp,
    },
  };
}
