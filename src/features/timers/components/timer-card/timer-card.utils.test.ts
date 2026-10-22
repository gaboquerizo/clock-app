import { describe, expect, it } from 'vitest';

import type { Timer } from '@/features/timers/domain/timer.types';
import {
  describeTimerDuration,
  formatTimerDuration,
  getTimerRemainingMs,
  getTimerStatusLabel,
  toTimerDurationDateTime,
} from './timer-card.utils';

const timerBase = {
  id: 'timer-1',
  durationMs: 90_000,
  label: '',
  createdAt: 1_000,
  updatedAt: 1_000,
};

describe('timer card presentation utilities', () => {
  it('formats durations with hours beyond a 24-hour clock and rounded seconds', () => {
    expect(formatTimerDuration(3_661_001)).toBe('01:01:02');
    expect(formatTimerDuration(176_400_000)).toBe('49:00:00');
    expect(formatTimerDuration(0)).toBe('00:00:00');
  });

  it('describes a duration accessibly in Spanish', () => {
    expect(describeTimerDuration(1_000)).toBe('1 segundo');
    expect(describeTimerDuration(3_661_000)).toBe(
      '1 hora, 1 minuto y 1 segundo',
    );
    expect(describeTimerDuration(0)).toBe('0 segundos');
  });

  it('formats ISO duration values for the time element', () => {
    expect(toTimerDurationDateTime(3_661_000)).toBe('PT1H1M1S');
    expect(toTimerDurationDateTime(60_000)).toBe('PT1M');
    expect(toTimerDurationDateTime(0)).toBe('PT0S');
  });

  it('derives running time from the absolute end timestamp', () => {
    const running: Timer = {
      ...timerBase,
      status: 'running',
      startedAt: 1_000,
      endsAt: 91_000,
      remainingAtStartMs: 90_000,
    };

    expect(getTimerRemainingMs(running, 31_000)).toBe(60_000);
    expect(getTimerRemainingMs(running, 100_000)).toBe(0);
  });

  it('uses stored remaining time for non-running timers and zero for completed', () => {
    const ready: Timer = {
      ...timerBase,
      status: 'ready',
      remainingMs: 90_000,
    };
    const paused: Timer = {
      ...timerBase,
      status: 'paused',
      remainingMs: 45_000,
    };
    const completed: Timer = {
      ...timerBase,
      status: 'completed',
      completedAt: 91_000,
      updatedAt: 91_000,
    };

    expect(getTimerRemainingMs(ready, 10_000)).toBe(90_000);
    expect(getTimerRemainingMs(paused, 10_000)).toBe(45_000);
    expect(getTimerRemainingMs(completed, 10_000)).toBe(0);
  });

  it('exposes Spanish labels for every timer state', () => {
    expect(
      getTimerStatusLabel({
        ...timerBase,
        status: 'ready',
        remainingMs: 90_000,
      }),
    ).toBe('Listo');
    expect(
      getTimerStatusLabel({
        ...timerBase,
        status: 'running',
        startedAt: 1_000,
        endsAt: 91_000,
        remainingAtStartMs: 90_000,
      }),
    ).toBe('En marcha');
    expect(
      getTimerStatusLabel({
        ...timerBase,
        status: 'paused',
        remainingMs: 45_000,
      }),
    ).toBe('Pausado');
    expect(
      getTimerStatusLabel({
        ...timerBase,
        status: 'completed',
        completedAt: 91_000,
        updatedAt: 91_000,
      }),
    ).toBe('Finalizado');
  });
});
