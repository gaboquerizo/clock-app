import type {
  ActiveGlobalAlert,
  GlobalAlertAction,
  GlobalAlertListener,
  GlobalAlertRequest,
  GlobalAlertService,
  GlobalAlertSnapshot,
} from '@/core/alerts/global-alert.types';

export function createGlobalAlertService(): GlobalAlertService {
  const listeners = new Set<GlobalAlertListener>();
  const queue: ActiveGlobalAlert[] = [];
  const alertIdsByEventId = new Map<string, string>();
  let active: ActiveGlobalAlert | undefined;
  let nextAlertId = 0;

  const getSnapshot = (): GlobalAlertSnapshot => ({
    active,
    queuedCount: queue.length,
  });

  const notify = () => {
    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const runLifecycle = (
    alert: ActiveGlobalAlert,
    phase: 'activation' | 'dismissal',
  ): Promise<void> => {
    const callback =
      phase === 'activation'
        ? alert.request.onActivate
        : alert.request.onDismiss;

    try {
      return Promise.resolve(callback?.()).then(
        () => undefined,
        (error: unknown) => {
          console.warn(`Global alert ${phase} callback failed.`, error);
        },
      );
    } catch (error) {
      console.warn(`Global alert ${phase} callback failed.`, error);
      return Promise.resolve();
    }
  };

  const setActive = (alert: ActiveGlobalAlert | undefined) => {
    active = alert;
    notify();

    if (alert !== undefined && active?.id === alert.id && !active.actionPending) {
      void runLifecycle(alert, 'activation');
    }
  };

  const advanceQueue = () => {
    setActive(queue.shift());
  };

  return {
    getSnapshot,

    subscribe(listener) {
      listeners.add(listener);
      listener(getSnapshot());

      return () => {
        listeners.delete(listener);
      };
    },

    present(request: GlobalAlertRequest) {
      const { secondaryAction, ...requestWithoutSecondaryAction } = request;
      const actions =
        secondaryAction === undefined
          ? request.actions
          : [...request.actions, secondaryAction];

      if (actions.length === 0) {
        throw new Error('A global alert must provide at least one action.');
      }

      const actionIds = actions.map(({ id }) => id);

      if (new Set(actionIds).size !== actionIds.length) {
        throw new Error('Global alert action identifiers must be unique.');
      }

      if (!actionIds.includes(request.primaryActionId)) {
        throw new Error(
          'The primary action must reference an action in the alert.',
        );
      }

      if (request.eventId !== undefined && request.eventId.trim() === '') {
        throw new Error('A global alert event identity must not be empty.');
      }

      const existingAlertId =
        request.eventId === undefined
          ? undefined
          : alertIdsByEventId.get(request.eventId);

      if (existingAlertId !== undefined) {
        return existingAlertId;
      }

      const alert: ActiveGlobalAlert = {
        id: `global-alert-${++nextAlertId}`,
        request: {
          ...requestWithoutSecondaryAction,
          actions: actions.map((action) => ({ ...action })),
        },
        actionPending: false,
      };

      if (request.eventId !== undefined) {
        alertIdsByEventId.set(request.eventId, alert.id);
      }

      if (active === undefined) {
        setActive(alert);
      } else {
        queue.push(alert);
        notify();
      }

      return alert.id;
    },

    async invalidate(eventId) {
      if (eventId.trim() === '') {
        return false;
      }

      const alertId = alertIdsByEventId.get(eventId);

      if (alertId === undefined) {
        return false;
      }

      if (active?.id === alertId) {
        if (active.actionPending) {
          return false;
        }

        const invalidated = active;
        active = { ...active, actionPending: true };
        notify();

        await runLifecycle(invalidated, 'dismissal');

        if (active?.id === alertId) {
          advanceQueue();
        }

        return true;
      }

      const queuedIndex = queue.findIndex(({ id }) => id === alertId);

      if (queuedIndex === -1) {
        return false;
      }

      const [invalidated] = queue.splice(queuedIndex, 1);
      notify();
      await runLifecycle(invalidated, 'dismissal');
      return true;
    },

    async invalidateByOrigin(originId) {
      if (originId.trim() === '') {
        return false;
      }

      const invalidatedQueued: ActiveGlobalAlert[] = [];

      for (let index = queue.length - 1; index >= 0; index -= 1) {
        if (queue[index].request.originId === originId) {
          const [invalidated] = queue.splice(index, 1);
          invalidatedQueued.unshift(invalidated);
        }
      }

      const invalidatedActive =
        active?.request.originId === originId && !active.actionPending
          ? active
          : undefined;

      if (invalidatedActive !== undefined) {
        active = { ...invalidatedActive, actionPending: true };
      }

      if (
        invalidatedActive !== undefined ||
        invalidatedQueued.length > 0
      ) {
        notify();
      }

      const queuedDismissals = Promise.all(
        invalidatedQueued.map((alert) => runLifecycle(alert, 'dismissal')),
      );

      if (invalidatedActive !== undefined) {
        await runLifecycle(invalidatedActive, 'dismissal');

        if (active?.id === invalidatedActive.id) {
          advanceQueue();
        }
      }

      await queuedDismissals;

      return (
        invalidatedActive !== undefined || invalidatedQueued.length > 0
      );
    },

    async dismiss(alertId) {
      if (active === undefined || active.id !== alertId || active.actionPending) {
        return false;
      }

      const dismissed = active;
      active = { ...active, actionPending: true };
      notify();

      await runLifecycle(dismissed, 'dismissal');

      if (active?.id === alertId) {
        advanceQueue();
      }

      return true;
    },

    async selectAction(alertId, actionId) {
      if (active === undefined || active.id !== alertId || active.actionPending) {
        return false;
      }

      const selectedAlert = active;
      const action = selectedAlert.request.actions.find(
        ({ id }) => id === actionId,
      );

      if (action === undefined || !isActionEnabled(action)) {
        return false;
      }

      active = { ...active, actionPending: true };
      notify();

      if (active?.id !== alertId) {
        return false;
      }

      const currentAction = active.request.actions.find(
        ({ id }) => id === actionId,
      );

      if (currentAction === undefined || !isActionEnabled(currentAction)) {
        active = { ...active, actionPending: false };
        notify();
        return false;
      }

      try {
        await currentAction.onSelect();
      } catch (error) {
        if (active?.id === alertId) {
          active = { ...active, actionPending: false };
          notify();
        }

        throw error;
      }

      if (active?.id === alertId) {
        await runLifecycle(selectedAlert, 'dismissal');

        if (active?.id === alertId) {
          advanceQueue();
        }
      }

      return true;
    },
  };
}

function isActionEnabled(action: GlobalAlertAction): boolean {
  try {
    return action.isEnabled?.() ?? true;
  } catch {
    return false;
  }
}

export const globalAlertService = createGlobalAlertService();
