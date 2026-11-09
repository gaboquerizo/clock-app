import { describe, expect, it } from 'vitest';

import { formatPomodoroCountdown } from './pomodoro-countdown-display.utils';

describe('Pomodoro countdown formatting', () => {
  it('uses MM:SS when the assigned duration is under one hour', () => {
    expect(formatPomodoroCountdown(25 * 60_000, 25 * 60_000)).toBe('25:00');
    expect(formatPomodoroCountdown(90_000, 25 * 60_000)).toBe('01:30');
  });

  it('uses HH:MM:SS for blocks assigned at least one hour', () => {
    expect(formatPomodoroCountdown(60 * 60_000, 60 * 60_000)).toBe('01:00:00');
    expect(formatPomodoroCountdown(59 * 60_000 + 59_000, 60 * 60_000)).toBe(
      '00:59:59',
    );
  });

  it('rounds remaining milliseconds up to the next displayed second', () => {
    expect(formatPomodoroCountdown(1, 25 * 60_000)).toBe('00:01');
    expect(formatPomodoroCountdown(60_001, 25 * 60_000)).toBe('01:01');
    expect(formatPomodoroCountdown(1, 60 * 60_000)).toBe('00:00:01');
  });

  it('formats hours beyond two digits and clamps invalid remaining values', () => {
    expect(formatPomodoroCountdown(100 * 60 * 60_000, 100 * 60 * 60_000)).toBe(
      '100:00:00',
    );
    expect(formatPomodoroCountdown(-1, 60 * 60_000)).toBe('00:00:00');
    expect(
      formatPomodoroCountdown(Number.POSITIVE_INFINITY, 25 * 60_000),
    ).toBe('00:00');
  });
});
