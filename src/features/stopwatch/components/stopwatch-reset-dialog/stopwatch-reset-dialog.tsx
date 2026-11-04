import { createSignal, Show } from 'solid-js';

import { useStopwatchState } from '@/features/stopwatch/state/stopwatch-context';
import AppIcon from '@/shared/ui/ui-icon/ui-icon';
import UiDialog from '@/shared/ui/ui-dialog/ui-dialog';

import './stopwatch-reset-dialog.css';

export type StopwatchResetDialogProps = {
  busy?: boolean;
  open: boolean;
  onClose: () => void;
};

export default function StopwatchResetDialog(
  props: StopwatchResetDialogProps,
) {
  const stopwatch = useStopwatchState();
  const [isConfirming, setIsConfirming] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const isBusy = () =>
    props.busy === true ||
    isConfirming() ||
    stopwatch.state.status === 'loading' ||
    stopwatch.state.status === 'saving';

  const closeDialog = () => {
    if (stopwatch.state.error?.operation === 'reset') {
      stopwatch.actions.clearError();
    }

    setError(undefined);
    props.onClose();
  };

  const confirmReset = async () => {
    if (isBusy()) {
      return;
    }

    setError(undefined);
    setIsConfirming(true);

    try {
      const result = await stopwatch.actions.reset();

      if (result.ok) {
        closeDialog();
      } else {
        setError(result.error.message);
      }
    } catch {
      setError('No se pudo reiniciar el cronómetro. Inténtalo nuevamente.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <UiDialog
      description="Se restablecerá el tiempo transcurrido y se eliminarán todas las vueltas registradas."
      icon={
        <AppIcon
          class="stopwatch-reset-dialog__icon"
          name="proicons:watch"
        />
      }
      open={props.open}
      title="¿Reiniciar el cronómetro?"
      onClose={closeDialog}
    >
      <div
        aria-busy={isBusy()}
        class="stopwatch-reset-dialog"
      >
        <Show when={error()}>
          {(message) => (
            <p class="stopwatch-reset-dialog__error" role="alert">
              {message()}
            </p>
          )}
        </Show>
        <div class="stopwatch-reset-dialog__actions">
          <button
            class="stopwatch-reset-dialog__button stopwatch-reset-dialog__button--secondary"
            disabled={isBusy()}
            type="button"
            onClick={closeDialog}
          >
            Cancelar
          </button>
          <button
            class="stopwatch-reset-dialog__button stopwatch-reset-dialog__button--danger"
            disabled={isBusy()}
            type="button"
            onClick={() => void confirmReset()}
          >
            Reiniciar
          </button>
        </div>
      </div>
    </UiDialog>
  );
}
