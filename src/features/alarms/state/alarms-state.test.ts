import { describe, expect, it } from 'vitest';

import type { Alarm } from '../domain/alarm.types';
import {
  createAlarmsState,
  type AlarmRepositoryPort,
} from './alarms-state';

const referenceTimestamp = new Date(2026, 0, 15, 6, 0).getTime();
const firstActivationAt = new Date(2026, 0, 15, 7, 0).getTime();
const secondActivationAt = new Date(2026, 0, 15, 8, 0).getTime();

function makeAlarm(
  id: string,
  order: number,
  options: { enabled?: boolean; nextActivationAt?: number; status?: Alarm['status'] } = {},
): Alarm {
  const timeById: Record<string, string> = {
    'first-active': '07:00',
    'inactive-first': '07:30',
    'second-active': '08:00',
    'inactive-later': '08:30',
    triggered: '09:00',
  };
  const createdAt = new Date(2026, 0, 14, 5, 0).getTime();
  const alarm: Alarm = {
    id,
    time: timeById[id] ?? '10:00',
    label: '',
    enabled: options.enabled ?? true,
    status: options.status ?? 'scheduled',
    order,
    createdAt,
    updatedAt: referenceTimestamp - 1_000,
  };

  if (options.nextActivationAt !== undefined) {
    alarm.nextActivationAt = options.nextActivationAt;
  }

  if (alarm.status === 'triggered') {
    alarm.triggeredAt = referenceTimestamp - 1_500;
  }

  return alarm;
}

function createMemoryRepository(alarms: Alarm[]): AlarmRepositoryPort {
  return {
    async list() {
      return [...alarms];
    },
    async create(alarm) {
      alarms.push(alarm);
    },
    async update(alarm) {
      const index = alarms.findIndex((current) => current.id === alarm.id);

      if (index >= 0) {
        alarms[index] = alarm;
      }
    },
    async remove(id) {
      const index = alarms.findIndex((current) => current.id === id);

      if (index >= 0) {
        alarms.splice(index, 1);
      }
    },
  };
}

describe('Alarms state ordering', () => {
  it('sorts enabled alarms by next activation, then preserves order for inactive alarms', async () => {
    const sourceAlarms = [
      makeAlarm('inactive-later', 2, { enabled: false }),
      makeAlarm('second-active', 3, {
        nextActivationAt: secondActivationAt,
      }),
      makeAlarm('inactive-first', 0, { enabled: false }),
      makeAlarm('first-active', 1, {
        nextActivationAt: firstActivationAt,
      }),
      makeAlarm('triggered', 3, { enabled: false, status: 'triggered' }),
    ];
    const controller = createAlarmsState({
      now: () => referenceTimestamp,
      repository: createMemoryRepository(sourceAlarms),
    });

    const result = await controller.actions.load();

    expect(result.ok).toBe(true);
    expect(controller.state.alarms.map(({ id }) => id)).toEqual([
      'first-active',
      'second-active',
      'inactive-first',
      'inactive-later',
      'triggered',
    ]);
    expect(sourceAlarms.map(({ id }) => id)).toEqual([
      'inactive-later',
      'second-active',
      'inactive-first',
      'first-active',
      'triggered',
    ]);
  });
});
