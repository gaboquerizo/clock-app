import { validateAlarm } from '../domain/alarm.rules';
import type { Alarm, AlarmResult, AlarmStatus } from '../domain/alarm.types';

export const ALARMS_DATABASE_NAME = 'clock-app';
export const ALARMS_DATABASE_VERSION = 1;
export const ALARMS_STORE_NAME = 'alarms';

export type AlarmRecord = {
  id: string;
  time: string;
  label: string;
  enabled: boolean;
  status: AlarmStatus;
  order: number;
  createdAt: number;
  updatedAt: number;
  triggeredAt?: number;
  skippedAt?: number;
};

export function toAlarmRecord(alarm: Alarm): AlarmRecord {
  return {
    id: alarm.id,
    time: alarm.time,
    label: alarm.label,
    enabled: alarm.enabled,
    status: alarm.status,
    order: alarm.order,
    createdAt: alarm.createdAt,
    updatedAt: alarm.updatedAt,
    ...(alarm.triggeredAt === undefined
      ? {}
      : { triggeredAt: alarm.triggeredAt }),
    ...(alarm.skippedAt === undefined ? {} : { skippedAt: alarm.skippedAt }),
  };
}

export function fromAlarmRecord(value: unknown): AlarmResult<Alarm> {
  return validateAlarm(value);
}
