export type NotificationPermissionState =
  | NotificationPermission
  | 'unsupported'
  | 'error';

export type NotificationRequestResult =
  | { status: NotificationPermission }
  | { status: 'unsupported' }
  | { status: 'error'; error: unknown };

export type NotificationDisplayRequest = {
  title: string;
  body: string;
  tag: string;
};

export type NotificationDisplayResult =
  | { status: 'shown' }
  | { status: 'unsupported' }
  | { status: 'permission-required' }
  | { status: 'error'; error: unknown };

export type NotificationService = {
  getPermission(): NotificationPermissionState;
  requestPermission(): Promise<NotificationRequestResult>;
  show(request: NotificationDisplayRequest): NotificationDisplayResult;
};

type NativeNotificationApi = {
  readonly permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  new (title: string, options?: NotificationOptions): Notification;
};

export type CreateNotificationServiceOptions = {
  getApi?: () => NativeNotificationApi | undefined;
};

function getBrowserNotificationApi(): NativeNotificationApi | undefined {
  if (
    typeof window === 'undefined' ||
    !window.isSecureContext ||
    typeof window.Notification === 'undefined'
  ) {
    return undefined;
  }

  return window.Notification;
}

export function createNotificationService(
  options: CreateNotificationServiceOptions = {},
): NotificationService {
  const getApi = options.getApi ?? getBrowserNotificationApi;

  return {
    getPermission() {
      try {
        return getApi()?.permission ?? 'unsupported';
      } catch {
        return 'error';
      }
    },

    async requestPermission() {
      let api: NativeNotificationApi | undefined;

      try {
        api = getApi();

        if (api === undefined) {
          return { status: 'unsupported' };
        }

        return { status: await api.requestPermission() };
      } catch (error) {
        return { status: 'error', error };
      }
    },

    show(request) {
      try {
        const api = getApi();

        if (api === undefined) {
          return { status: 'unsupported' };
        }

        if (api.permission !== 'granted') {
          return { status: 'permission-required' };
        }

        new api(request.title, {
          body: request.body,
          tag: request.tag,
          silent: true,
        });

        return { status: 'shown' };
      } catch (error) {
        return { status: 'error', error };
      }
    },
  };
}

export const notificationService = createNotificationService();
