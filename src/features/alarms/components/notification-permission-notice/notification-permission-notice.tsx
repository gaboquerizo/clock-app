import { createSignal, onCleanup, onMount, Show } from 'solid-js';

import { appPreferencesRepository } from '@/core/storage/app-preferences.repository';
import { notificationService } from '@/core/services/notification.service';

import './notification-permission-notice.css';

const DISMISS_PREFERENCE_KEY =
  'notifications.alarm-recommendation-dismissed';

export default function NotificationPermissionNotice() {
  const [permission, setPermission] = createSignal(
    notificationService.getPermission(),
  );
  const [dismissed, setDismissed] = createSignal(false);
  const [preferenceLoaded, setPreferenceLoaded] = createSignal(false);
  const [requesting, setRequesting] = createSignal(false);
  const [feedback, setFeedback] = createSignal<string | undefined>();
  let isMounted = true;

  onCleanup(() => {
    isMounted = false;
  });

  onMount(() => {
    void appPreferencesRepository
      .get<boolean>(DISMISS_PREFERENCE_KEY)
      .then((wasDismissed) => {
        if (isMounted) {
          setDismissed(wasDismissed === true);
        }
      })
      .catch((error: unknown) => {
        console.warn('Unable to load notification recommendation preference.', error);
      })
      .finally(() => {
        if (isMounted) {
          setPreferenceLoaded(true);
        }
      });
  });

  const shouldShow = () =>
    preferenceLoaded() &&
    !dismissed() &&
    (permission() === 'default' || permission() === 'denied');

  const handleRequestPermission = async () => {
    if (requesting()) {
      return;
    }

    setRequesting(true);
    setFeedback(undefined);

    try {
      const result = await notificationService.requestPermission();
      setPermission(result.status);

      if (result.status === 'default') {
        setFeedback('No se concedió el permiso. Puedes intentarlo de nuevo.');
      } else if (result.status === 'denied') {
        setFeedback(
          'El navegador bloqueó las notificaciones. Puedes habilitarlas desde los permisos de este sitio.',
        );
      } else if (result.status === 'error') {
        console.warn('Unable to request notification permission.', result.error);
        setPermission(notificationService.getPermission());
        setFeedback('No se pudo solicitar el permiso de notificaciones.');
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setFeedback(undefined);

    void appPreferencesRepository
      .set(DISMISS_PREFERENCE_KEY, true)
      .catch((error: unknown) => {
        console.warn('Unable to save notification recommendation preference.', error);
        setFeedback(
          'La recomendación se ocultó durante esta sesión, pero no se pudo guardar la preferencia.',
        );
      });
  };

  return (
    <>
      <Show when={shouldShow()}>
        <aside
          aria-label="Notificaciones del navegador para alarmas"
          class="notification-permission-notice"
        >
          <div class="notification-permission-notice__copy">
            <h2 class="notification-permission-notice__title">
              Recibe avisos de tus alarmas
            </h2>
            <p class="notification-permission-notice__description">
              <Show
                when={permission() === 'denied'}
                fallback={
                  <>
                    Activa las notificaciones del navegador para recibir un aviso
                    del sistema mientras Clock App está en ejecución.
                  </>
                }
              >
                El navegador bloqueó las notificaciones. Puedes habilitarlas
                desde los permisos de este sitio; las alarmas seguirán mostrando
                avisos en Clock App y reproduciendo sonido cuando corresponda.
              </Show>
            </p>
            <Show when={feedback() !== undefined}>
              <p
                aria-live="polite"
                class="notification-permission-notice__feedback"
                role="status"
              >
                {feedback()}
              </p>
            </Show>
          </div>

          <div class="notification-permission-notice__actions">
            <Show when={permission() === 'default'}>
              <button
                class="notification-permission-notice__enable"
                disabled={requesting()}
                onClick={() => void handleRequestPermission()}
                type="button"
              >
                {requesting() ? 'Solicitando…' : 'Activar notificaciones'}
              </button>
            </Show>
            <button
              class="notification-permission-notice__dismiss"
              onClick={handleDismiss}
              type="button"
            >
              No volver a mostrar
            </button>
          </div>
        </aside>
      </Show>

      <Show
        when={
          feedback() !== undefined && (dismissed() || !shouldShow())
        }
      >
        <p
          aria-live="polite"
          class="notification-permission-notice__save-feedback"
          role="status"
        >
          {feedback()}
        </p>
      </Show>
    </>
  );
}
