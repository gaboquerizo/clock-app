import type {
  Stopwatch,
  StopwatchResult,
} from '@/features/stopwatch/domain/stopwatch.types';
import { validateStopwatch } from '@/features/stopwatch/domain/stopwatch.rules';

export const STOPWATCH_DATABASE_NAME = 'clock-app-stopwatch';
export const STOPWATCH_DATABASE_VERSION = 1;
export const STOPWATCH_STORE_NAME = 'stopwatch';
export const STOPWATCH_RECORD_ID = 'current';

type StopwatchLapRecord = {
  number: number;
  durationMs: number;
  elapsedMs: number;
};

type StopwatchRecordBase = {
  id: typeof STOPWATCH_RECORD_ID;
  laps: StopwatchLapRecord[];
};

export type StopwatchRecord =
  | (StopwatchRecordBase & {
      status: 'idle';
      accumulatedMs: 0;
    })
  | (StopwatchRecordBase & {
      status: 'running';
      accumulatedMs: number;
      startedAt: number;
    })
  | (StopwatchRecordBase & {
      status: 'paused';
      accumulatedMs: number;
    });

export function toStopwatchRecord(stopwatch: Stopwatch): StopwatchRecord {
  const base: StopwatchRecordBase = {
    id: STOPWATCH_RECORD_ID,
    laps: stopwatch.laps.map((lap) => ({
      number: lap.number,
      durationMs: lap.durationMs,
      elapsedMs: lap.elapsedMs,
    })),
  };

  switch (stopwatch.status) {
    case 'idle':
      return { ...base, status: 'idle', accumulatedMs: 0 };
    case 'running':
      return {
        ...base,
        status: 'running',
        accumulatedMs: stopwatch.accumulatedMs,
        startedAt: stopwatch.startedAt,
      };
    case 'paused':
      return {
        ...base,
        status: 'paused',
        accumulatedMs: stopwatch.accumulatedMs,
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fromStopwatchRecord(
  value: unknown,
): StopwatchResult<Stopwatch> {
  if (!isRecord(value) || value.id !== STOPWATCH_RECORD_ID) {
    return {
      ok: false as const,
      error: { code: 'invalid-state' as const },
    };
  }

  return validateStopwatch({
    status: value.status,
    accumulatedMs: value.accumulatedMs,
    startedAt: value.startedAt,
    laps: value.laps,
  });
}
