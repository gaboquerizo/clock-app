import {
  createScheduler,
  type Scheduler,
  type SchedulerReconcileEvent,
  type SchedulerTriggerEvent,
} from '@/core/time/scheduler';
import type { CompletedTimer, Timer } from '@/features/timers/domain/timer.types';
import type { TimersStateController } from '@/features/timers/state/timers-state';

const TIMER_PROCESS_PREFIX = 'timer:';

export type TimerCompletionEvent = {
  timer: CompletedTimer;
  observedAt: number;
  scheduledAt: number;
  reason: SchedulerTriggerEvent['reason'];
};

export type TimerCompletionListener = (
  event: TimerCompletionEvent,
) => void | Promise<void>;

export type TimersRuntimeOptions = {
  scheduler?: Scheduler;
};

export type TimersRuntime = {
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: TimerCompletionListener): () => void;
  sync(timers?: readonly Timer[]): void;
  cancel(timerId: string): void;
};

function getProcessId(timerId: string): string {
  return `${TIMER_PROCESS_PREFIX}${timerId}`;
}

export function createTimersRuntime(
  controller: TimersStateController,
  options: TimersRuntimeOptions = {},
): TimersRuntime {
  const ownsScheduler = options.scheduler === undefined;
  const scheduler = options.scheduler ?? createScheduler();
  const registeredAt = new Map<string, number>();
  const listeners = new Set<TimerCompletionListener>();
  let isStarted = false;
  let isReady = false;
  let startPromise: Promise<void> | undefined;

  const emitCompletion = (event: TimerCompletionEvent) => {
    for (const listener of listeners) {
      void Promise.resolve(listener(event)).catch(() => undefined);
    }
  };

  const handleReconcile = async (
    timerId: string,
    event: SchedulerReconcileEvent,
  ) => {
    const result = await controller.actions.reconcile(timerId, event.observedAt);

    if (result.ok) {
      sync();
    }
  };

  const handleTrigger = async (event: SchedulerTriggerEvent) => {
    const timerId = event.id.slice(TIMER_PROCESS_PREFIX.length);
    registeredAt.delete(timerId);

    const result = await controller.actions.reconcile(timerId, event.observedAt);

    if (!result.ok) {
      return;
    }

    if (result.value.status === 'completed') {
      emitCompletion({
        timer: result.value,
        observedAt: event.observedAt,
        scheduledAt: event.scheduledAt,
        reason: event.reason,
      });
    }

    sync();
  };

  function sync(timers = controller.state.timers) {
    if (!isStarted || !isReady) {
      return;
    }

    const runningTimers = new Map(
      timers
        .filter((timer) => timer.status === 'running')
        .map((timer) => [timer.id, timer] as const),
    );

    for (const timerId of registeredAt.keys()) {
      if (!runningTimers.has(timerId)) {
        scheduler.unregister(getProcessId(timerId));
        registeredAt.delete(timerId);
      }
    }

    for (const timer of runningTimers.values()) {
      if (registeredAt.get(timer.id) === timer.endsAt) {
        continue;
      }

      scheduler.register({
        at: timer.endsAt,
        id: getProcessId(timer.id),
        onReconcile: (event) => handleReconcile(timer.id, event),
        onTrigger: handleTrigger,
      });
      registeredAt.set(timer.id, timer.endsAt);
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

      if (ownsScheduler) {
        scheduler.start();
      }

      startPromise = (async () => {
        const loaded = await controller.actions.load();
        isReady = true;
        sync();

        if (loaded.ok) {
          await scheduler.reconcile();
        }
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

      for (const timerId of registeredAt.keys()) {
        scheduler.unregister(getProcessId(timerId));
      }

      registeredAt.clear();

      if (ownsScheduler) {
        scheduler.stop();
      }
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    sync,

    cancel(timerId) {
      scheduler.unregister(getProcessId(timerId));
      registeredAt.delete(timerId);
    },
  };
}
