import type {
  ActiveGlobalAlert,
  GlobalAlertListener,
  GlobalAlertRequest,
  GlobalAlertService,
  GlobalAlertSnapshot,
} from '@/core/alerts/global-alert.types';

export function createGlobalAlertService(): GlobalAlertService {
  const listeners = new Set<GlobalAlertListener>();
  const queue: ActiveGlobalAlert[] = [];
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

  const advanceQueue = () => {
    active = queue.shift();
    notify();
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
      const alert: ActiveGlobalAlert = {
        id: `global-alert-${++nextAlertId}`,
        request: {
          ...request,
          actions: request.actions.map((action) => ({ ...action })),
        },
        actionPending: false,
      };

      if (active === undefined) {
        active = alert;
        notify();
      } else {
        queue.push(alert);
        notify();
      }

      return alert.id;
    },

    async dismiss(alertId) {
      if (active === undefined || active.id !== alertId || active.actionPending) {
        return false;
      }

      const dismissed = active;
      advanceQueue();
      await dismissed.request.onDismiss?.();

      return true;
    },

    async selectAction(alertId, actionId) {
      if (active === undefined || active.id !== alertId || active.actionPending) {
        return false;
      }

      const action = active.request.actions.find(({ id }) => id === actionId);

      if (action === undefined) {
        return false;
      }

      active = { ...active, actionPending: true };
      notify();

      try {
        await action.onSelect();
      } catch (error) {
        if (active?.id === alertId) {
          active = { ...active, actionPending: false };
          notify();
        }

        throw error;
      }

      if (active?.id === alertId) {
        advanceQueue();
      }

      return true;
    },
  };
}

export const globalAlertService = createGlobalAlertService();
