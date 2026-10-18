import { createEffect, createSignal, For, Show } from 'solid-js';

import type { ActiveGlobalAlert } from '@/core/alerts/global-alert.types';
import UiDialog from '@/shared/ui/ui-dialog/ui-dialog';
import UiIcon, { type IconName } from '@/shared/ui/ui-icon/ui-icon';

import './global-alert-dialog.css';

type GlobalAlertDialogProps = {
  alert: ActiveGlobalAlert | undefined;
  onDismiss(alertId: string): Promise<boolean>;
  onSelectAction(alertId: string, actionId: string): Promise<boolean>;
};

const actionFailureMessage =
  'No se pudo completar la acción. Inténtalo de nuevo.';

export default function GlobalAlertDialog(props: GlobalAlertDialogProps) {
  const [actionError, setActionError] = createSignal<string>();
  let primaryActionButton: HTMLButtonElement | undefined;

  createEffect(() => {
    const alert = props.alert;

    if (alert === undefined) {
      setActionError(undefined);
      return;
    }

    setActionError(undefined);

    if (!alert.actionPending) {
      primaryActionButton?.focus();
    }
  });

  const dismiss = (alertId: string) => {
    void props.onDismiss(alertId).catch(() => {
      if (props.alert?.id === alertId) {
        setActionError(actionFailureMessage);
      }
    });
  };

  const selectAction = (alertId: string, actionId: string) => {
    setActionError(undefined);

    void props.onSelectAction(alertId, actionId).catch(() => {
      if (props.alert?.id === alertId) {
        setActionError(actionFailureMessage);
      }
    });
  };

  return (
    <UiDialog
      class="global-alert-dialog"
      closeOnBackdrop={false}
      description={props.alert?.request.message}
      icon={
        props.alert && (
          <UiIcon
            class="global-alert-dialog__icon"
            name={props.alert.request.icon as IconName}
          />
        )
      }
      open={props.alert !== undefined}
      title={props.alert?.request.title ?? ''}
      onClose={() => {
        const alertId = props.alert?.id;

        if (alertId !== undefined) {
          dismiss(alertId);
        }
      }}
    >
      <Show keyed when={props.alert}>
        {(alert) => (
          <div
            aria-busy={alert.actionPending}
            class="global-alert-dialog__content"
          >
            <Show when={actionError()}>
              {(message) => (
                <p class="global-alert-dialog__error" role="alert">
                  {message()}
                </p>
              )}
            </Show>

            <div
              aria-label="Acciones del aviso"
              class="global-alert-dialog__actions"
              role="group"
            >
              <For each={alert.request.actions}>
                {(action) => {
                  const isPrimary =
                    action.id === alert.request.primaryActionId;

                  return (
                    <button
                      autofocus={isPrimary}
                      class={`global-alert-dialog__action global-alert-dialog__action--${action.emphasis}`}
                      data-primary={isPrimary ? 'true' : undefined}
                      disabled={alert.actionPending}
                      ref={(element) => {
                        if (isPrimary) {
                          primaryActionButton = element;
                        }
                      }}
                      type="button"
                      onClick={() => selectAction(alert.id, action.id)}
                    >
                      {action.label}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        )}
      </Show>
    </UiDialog>
  );
}
