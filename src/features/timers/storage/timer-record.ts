import { validateTimer } from '@/features/timers/domain/timer';

import type {
  Timer,
  TimerResult,
} from '@/features/timers/domain/timer.types';

export const TIMERS_DATABASE_NAME = 'clock-app-timers';
export const TIMERS_DATABASE_VERSION = 1;
export const TIMERS_STORE_NAME = 'timers';

type TimerRecordBase = {
  id: string;
  durationMs: number;
  label: string;
  createdAt: number;
  updatedAt: number;
};

export type TimerRecord = TimerRecordBase &
  (
    | { status: 'ready'; remainingMs: number }
    | {
        status: 'running';
        startedAt: number;
        endsAt: number;
        remainingAtStartMs: number;
      }
    | { status: 'paused'; remainingMs: number }
    | { status: 'completed'; completedAt: number }
  );

export function toTimerRecord(timer: Timer): TimerRecord {
  const base: TimerRecordBase = {
    id: timer.id,
    durationMs: timer.durationMs,
    label: timer.label,
    createdAt: timer.createdAt,
    updatedAt: timer.updatedAt,
  };

  switch (timer.status) {
    case 'ready':
      return { ...base, status: 'ready', remainingMs: timer.remainingMs };
    case 'running':
      return {
        ...base,
        status: 'running',
        startedAt: timer.startedAt,
        endsAt: timer.endsAt,
        remainingAtStartMs: timer.remainingAtStartMs,
      };
    case 'paused':
      return { ...base, status: 'paused', remainingMs: timer.remainingMs };
    case 'completed':
      return { ...base, status: 'completed', completedAt: timer.completedAt };
  }
}

export function fromTimerRecord(value: unknown): TimerResult<Timer> {
  return validateTimer(value);
}
