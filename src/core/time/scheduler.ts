/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Types â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
export type SchedulerEventReason = 'activation' | 'recovery';

export type SchedulerTriggerEvent = {
  id: string;
  scheduledAt: number;
  observedAt: number;
  reason: SchedulerEventReason;
};

export type SchedulerReconcileEvent = {
  id: string;
  scheduledAt: number;
  observedAt: number;
  reason: 'recovery';
};

export type SchedulerProcess = {
  at: number;
  id: string;
  onReconcile?: (event: SchedulerReconcileEvent) => void | Promise<void>;
  onTrigger: (event: SchedulerTriggerEvent) => void | Promise<void>;
};

type SchedulerTimer = ReturnType<typeof globalThis.setTimeout>;

export type SchedulerOptions = {
  clearTimeout?: (timer: SchedulerTimer) => void;
  now?: () => number;
  setTimeout?: (handler: () => void, timeout: number) => SchedulerTimer;
};

export type Scheduler = {
  reconcile(referenceTimestamp?: number): Promise<void>;
  register(process: SchedulerProcess): void;
  start(): void;
  stop(): void;
  unregister(id: string): void;
};

const MAX_TIMEOUT_DELAY = 2_147_483_647;

/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Factory â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  const now = options.now ?? (() => Date.now());
  const scheduleTimeout =
    options.setTimeout ??
    ((handler, timeout) => globalThis.setTimeout(handler, timeout));
  const cancelTimeout =
    options.clearTimeout ?? ((timer) => globalThis.clearTimeout(timer));
  const processes = new Map<string, SchedulerProcess>();
  const timers = new Map<string, SchedulerTimer>();
  let isStarted = false;
  let reconciliationPromise: Promise<void> | undefined;

  const handleActivity = () => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    void reconcile().catch(() => undefined);
  };

  const clearTimer = (id: string) => {
    const timer = timers.get(id);

    if (timer === undefined) {
      return;
    }

    cancelTimeout(timer);
    timers.delete(id);
  };

  const schedule = (id: string) => {
    if (!isStarted) {
      return;
    }

    const process = processes.get(id);

    if (process === undefined) {
      return;
    }

    clearTimer(id);

    const delay = Math.min(
      MAX_TIMEOUT_DELAY,
      Math.max(0, process.at - now()),
    );
    let timer: SchedulerTimer;

    timer = scheduleTimeout(() => {
      if (timers.get(id) === timer) {
        timers.delete(id);
      }

      void handleTimer(id, process);
    }, delay);

    timers.set(id, timer);
  };

  const handleTimer = async (id: string, expectedProcess: SchedulerProcess) => {
    const process = processes.get(id);

    if (process !== expectedProcess) {
      return;
    }

    const observedAt = now();

    if (observedAt < process.at) {
      schedule(id);
      return;
    }

    processes.delete(id);
    clearTimer(id);

    await process.onTrigger({
      id,
      scheduledAt: process.at,
      observedAt,
      reason: 'activation',
    });
  };

  async function reconcile(referenceTimestamp = now()): Promise<void> {
    if (reconciliationPromise !== undefined) {
      return reconciliationPromise;
    }

    const observedAt = referenceTimestamp;
    const promise = (async () => {
      for (const process of [...processes.values()]) {
        if (processes.get(process.id) !== process) {
          continue;
        }

        if (process.at <= observedAt) {
          processes.delete(process.id);
          clearTimer(process.id);

          await process.onTrigger({
            id: process.id,
            scheduledAt: process.at,
            observedAt,
            reason: 'recovery',
          });
          continue;
        }

        if (process.onReconcile !== undefined) {
          await process.onReconcile({
            id: process.id,
            scheduledAt: process.at,
            observedAt,
            reason: 'recovery',
          });
        }

        if (processes.get(process.id) === process) {
          schedule(process.id);
        }
      }
    })();

    reconciliationPromise = promise;
    promise.then(
      () => {
        if (reconciliationPromise === promise) {
          reconciliationPromise = undefined;
        }
      },
      () => {
        if (reconciliationPromise === promise) {
          reconciliationPromise = undefined;
        }
      },
    );

    return promise;
  }

  return {
    reconcile,

    register(process) {
      if (!Number.isFinite(process.at)) {
        throw new TypeError('Scheduler processes require a finite timestamp.');
      }

      clearTimer(process.id);
      processes.set(process.id, process);
      schedule(process.id);
    },

    start() {
      if (isStarted) {
        return;
      }

      isStarted = true;

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleActivity);
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('focus', handleActivity);
        window.addEventListener('pageshow', handleActivity);
      }

      for (const process of processes.values()) {
        schedule(process.id);
      }

      void reconcile().catch(() => undefined);
    },

    stop() {
      if (!isStarted) {
        return;
      }

      isStarted = false;

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleActivity);
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleActivity);
        window.removeEventListener('pageshow', handleActivity);
      }

      for (const id of [...timers.keys()]) {
        clearTimer(id);
      }

      processes.clear();
    },

    unregister(id) {
      clearTimer(id);
      processes.delete(id);
    },
  };
}
