import {
  type Scheduler,
  type SchedulerTriggerEvent,
} from '@/core/time/scheduler';
import type {
  PomodoroBlockCompletedEvent,
  PomodoroCycle,
} from '@/features/pomodoro/domain/pomodoro.types';

import type {
  PomodoroStateController,
  PomodoroStateStatus,
} from './pomodoro-state';

const POMODORO_PROCESS_PREFIX = 'pomodoro-block:';

export type PomodoroBlockExpirationEvent = PomodoroBlockCompletedEvent & {
  scheduledAt: number;
  observedAt: number;
  reason: SchedulerTriggerEvent['reason'];
};

export type PomodoroBlockExpirationListener = (
  event: PomodoroBlockExpirationEvent,
) => void | Promise<void>;

export type PomodoroRuntimeOptions = {
  scheduler: Scheduler;
};

export type PomodoroRuntime = {
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: PomodoroBlockExpirationListener): () => void;
  sync(
    cycle?: PomodoroCycle | undefined,
    status?: PomodoroStateStatus,
  ): void;
};

function getProcessId(cycle: PomodoroCycle): string {
  return `${POMODORO_PROCESS_PREFIX}${encodeURIComponent(cycle.id)}:${encodeURIComponent(cycle.currentBlock.id)}`;
}

function emitExpiration(
  listeners: Set<PomodoroBlockExpirationListener>,
  event: PomodoroBlockExpirationEvent,
): void {
  for (const listener of listeners) {
    void Promise.resolve(listener(event)).catch(() => undefined);
  }
}

export function createPomodoroRuntime(
  controller: PomodoroStateController,
  options: PomodoroRuntimeOptions,
): PomodoroRuntime {
  const scheduler = options.scheduler;
  const registeredAt = new Map<string, number>();
  const listeners = new Set<PomodoroBlockExpirationListener>();
  let isStarted = false;
  let isReady = false;
  let startPromise: Promise<void> | undefined;

  const handleTrigger = (event: SchedulerTriggerEvent): void => {
    const expectedDeadline = registeredAt.get(event.id);
    registeredAt.delete(event.id);

    const cycle = controller.state.cycle;

    if (
      expectedDeadline !== event.scheduledAt ||
      cycle?.status !== 'running' ||
      getProcessId(cycle) !== event.id ||
      cycle.endsAt !== event.scheduledAt
    ) {
      sync();
      return;
    }

    emitExpiration(listeners, {
      type: 'block-completed',
      cycleId: cycle.id,
      blockExecutionId: cycle.currentBlock.id,
      blockType: cycle.currentBlock.type,
      completedAt: event.scheduledAt,
      scheduledAt: event.scheduledAt,
      observedAt: event.observedAt,
      reason: event.reason,
    });
  };

  function sync(
    cycle = controller.state.cycle,
    status = controller.state.status,
  ): void {
    if (!isStarted || !isReady) {
      return;
    }

    const runningCycle =
      (status === 'ready' || status === 'error') && cycle?.status === 'running'
        ? cycle
        : undefined;
    const desiredProcessId =
      runningCycle === undefined ? undefined : getProcessId(runningCycle);

    for (const processId of registeredAt.keys()) {
      if (processId !== desiredProcessId) {
        scheduler.unregister(processId);
        registeredAt.delete(processId);
      }
    }

    if (runningCycle === undefined || desiredProcessId === undefined) {
      return;
    }

    if (registeredAt.get(desiredProcessId) === runningCycle.endsAt) {
      return;
    }

    scheduler.register({
      at: runningCycle.endsAt,
      id: desiredProcessId,
      onTrigger: handleTrigger,
    });
    registeredAt.set(desiredProcessId, runningCycle.endsAt);
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
      startPromise = (async () => {
        await controller.actions.load();

        if (!isStarted) {
          return;
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

      for (const processId of registeredAt.keys()) {
        scheduler.unregister(processId);
      }

      registeredAt.clear();
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
