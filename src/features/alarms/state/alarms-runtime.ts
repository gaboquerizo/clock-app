/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Library â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
import {
  createScheduler,
  type Scheduler,
  type SchedulerTriggerEvent,
} from '../../../core/time/scheduler';

/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Types â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
import type { Alarm } from '../domain/alarm.types';
import type { AlarmsStateController } from './alarms-state';

const ALARM_PROCESS_PREFIX = 'alarm:';

export type AlarmActivationEvent = {
  alarm: Alarm;
  observedAt: number;
  scheduledAt: number;
};

export type AlarmActivationListener = (
  event: AlarmActivationEvent,
) => void | Promise<void>;

export type AlarmsRuntimeOptions = {
  scheduler?: Scheduler;
};

export type AlarmsRuntime = {
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: AlarmActivationListener): () => void;
  sync(alarms?: readonly Alarm[]): void;
};

function getProcessId(alarmId: string): string {
  return `${ALARM_PROCESS_PREFIX}${alarmId}`;
}

/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Factory â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
export function createAlarmsRuntime(
  controller: AlarmsStateController,
  options: AlarmsRuntimeOptions = {},
): AlarmsRuntime {
  const scheduler = options.scheduler ?? createScheduler();
  const registeredAt = new Map<string, number>();
  const listeners = new Set<AlarmActivationListener>();
  let isStarted = false;
  let isReady = false;
  let startPromise: Promise<void> | undefined;

  const emitActivation = (event: AlarmActivationEvent) => {
    for (const listener of listeners) {
      void Promise.resolve(listener(event)).catch(() => undefined);
    }
  };

  const handleReconcile = async (alarmId: string) => {
    await controller.actions.reconcile(alarmId, 'recovery');
    sync();
  };

  const handleTrigger = async (event: SchedulerTriggerEvent) => {
    const alarmId = event.id.slice(ALARM_PROCESS_PREFIX.length);
    registeredAt.delete(alarmId);

    const result = await controller.actions.reconcile(
      alarmId,
      event.reason === 'activation' ? 'activation' : 'recovery',
    );

    if (result.ok && result.value.status === 'triggered') {
      emitActivation({
        alarm: result.value,
        observedAt: event.observedAt,
        scheduledAt: event.scheduledAt,
      });
    }

    sync();
  };

  function sync(alarms = controller.state.alarms) {
    if (!isStarted || !isReady) {
      return;
    }

    const activeAlarms = new Map(
      alarms
        .filter(
          (alarm) =>
            alarm.enabled &&
            alarm.status === 'scheduled' &&
            alarm.nextActivationAt !== undefined,
        )
        .map((alarm) => [alarm.id, alarm] as const),
    );

    for (const alarmId of registeredAt.keys()) {
      if (!activeAlarms.has(alarmId)) {
        scheduler.unregister(getProcessId(alarmId));
        registeredAt.delete(alarmId);
      }
    }

    for (const alarm of activeAlarms.values()) {
      const nextActivationAt = alarm.nextActivationAt;

      if (
        nextActivationAt === undefined ||
        registeredAt.get(alarm.id) === nextActivationAt
      ) {
        continue;
      }

      const processId = getProcessId(alarm.id);

      scheduler.register({
        at: nextActivationAt,
        id: processId,
        onReconcile: () => handleReconcile(alarm.id),
        onTrigger: handleTrigger,
      });
      registeredAt.set(alarm.id, nextActivationAt);
    }
  }

  return {
    async start() {
      if (startPromise !== undefined) {
        return startPromise;
      }

      if (isStarted) {
        return;
      }

      isStarted = true;
      scheduler.start();

      startPromise = (async () => {
        const loaded = await controller.actions.load();

        if (!loaded.ok) {
          isReady = true;
          sync();
          return;
        }

        for (const alarm of [...controller.state.alarms]) {
          if (alarm.enabled && alarm.status === 'scheduled') {
            await controller.actions.reconcile(alarm.id, 'recovery');
          }
        }

        isReady = true;
        sync();
      })();

      try {
        await startPromise;
      } finally {
        startPromise = undefined;
      }
    },

    stop() {
      if (!isStarted) {
        return;
      }

      isStarted = false;
      isReady = false;
      registeredAt.clear();
      scheduler.stop();
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    sync,
  };
}
