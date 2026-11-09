import './pomodoro-cycle-reset-dialog.css';

import { createSignal, Show } from 'solid-js';

import { globalAlertService } from '@/core/alerts/global-alert-service';
import { usePomodoroState } from '@/features/pomodoro/state/pomodoro-context';
import AppIcon from '@/shared/ui/ui-icon/ui-icon';
import UiDialog from '@/shared/ui/ui-dialog/ui-dialog';

type PomodoroCycleResetDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function PomodoroCycleResetDialog(
  props: PomodoroCycleResetDialogProps,
) {
  const pomodoro = usePomodoroState();
  const [isConfirming, setIsConfirming] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const isBusy = () =>
    isConfirming() ||
    pomodoro.state.status === 'loading' ||
    pomodoro.state.status === 'saving';

  const closeDialog = () => {
    if (isBusy()) {
      return;
    }

    if (pomodoro.state.error?.operation === 'reset-cycle') {
      pomodoro.actions.clearError();
    }

    setError(undefined);
    props.onClose();
  };

  const confirmReset = async () => {
    if (isBusy()) {
      return;
    }

    const discardedCycleId = pomodoro.state.cycle?.id;
    setError(undefined);
    setIsConfirming(true);

    try {
      const result = await pomodoro.actions.resetCycle();

      if (result.ok) {
        if (discardedCycleId !== undefined) {
          void globalAlertService
            .invalidateByOrigin(discardedCycleId)
            .catch((invalidationError: unknown) => {
              console.warn(
                'Pomodoro alerts for the discarded cycle could not be invalidated.',
                invalidationError,
              );
            });
        }

        setIsConfirming(false);
        closeDialog();
        return;
      }

      setError(
        'No se pudo reiniciar el ciclo. El estado actual se conserva; inténtalo de nuevo.',
      );
    } catch {
      setError(
        'No se pudo reiniciar el ciclo. El estado actual se conserva; inténtalo de nuevo.',
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <UiDialog
      description="Se descartará el progreso actual y el ciclo volverá a la primera concentración, en estado listo."
      icon={
        <AppIcon
          class="pomodoro-cycle-reset-dialog__icon"
          name="proicons:arrow-counterclockwise"
        />
      }
      open={props.open}
      title="¿Reiniciar el ciclo Pomodoro?"
      onClose={closeDialog}
    >
      <div
        aria-busy={isBusy()}
        class="pomodoro-cycle-reset-dialog"
      >
        <Show when={error()}>
          {(message) => (
            <p class="pomodoro-cycle-reset-dialog__error" role="alert">
              {message()}
            </p>
          )}
        </Show>
        <div class="pomodoro-cycle-reset-dialog__actions">
          <button
            class="pomodoro-cycle-reset-dialog__button pomodoro-cycle-reset-dialog__button--secondary"
            disabled={isBusy()}
            type="button"
            onClick={closeDialog}
          >
            Cancelar
          </button>
          <button
            class="pomodoro-cycle-reset-dialog__button pomodoro-cycle-reset-dialog__button--danger"
            disabled={isBusy()}
            type="button"
            onClick={() => void confirmReset()}
          >
            {isConfirming() ? 'Reiniciando…' : 'Reiniciar ciclo'}
          </button>
        </div>
      </div>
    </UiDialog>
  );
}
