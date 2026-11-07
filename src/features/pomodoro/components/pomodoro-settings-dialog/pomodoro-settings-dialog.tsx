import './pomodoro-settings-dialog.css';

import { createEffect, createMemo, createSignal, Show } from 'solid-js';

import PomodoroDurationFields, {
  type PomodoroPreferencesDraft,
} from '@/features/pomodoro/components/pomodoro-duration-fields/pomodoro-duration-fields';
import { validatePomodoroPreferences } from '@/features/pomodoro/domain/pomodoro-preferences';
import type { PomodoroPreferences } from '@/features/pomodoro/domain/pomodoro.types';
import { usePomodoroState } from '@/features/pomodoro/state/pomodoro-context';
import UiDialog from '@/shared/ui/ui-dialog/ui-dialog';
import AppIcon from '@/shared/ui/ui-icon/ui-icon';

type PomodoroSettingsDialogProps = {
  onClose: () => void;
  open: boolean;
};

function createDraft(preferences: PomodoroPreferences): PomodoroPreferencesDraft {
  return {
    focusDurationMinutes: String(preferences.focusDurationMinutes),
    shortBreakDurationMinutes: String(preferences.shortBreakDurationMinutes),
    longBreakDurationMinutes: String(preferences.longBreakDurationMinutes),
  };
}

function parseMinutes(value: string): number | undefined {
  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : Number(trimmedValue);
}

export default function PomodoroSettingsDialog(
  props: PomodoroSettingsDialogProps,
) {
  const pomodoro = usePomodoroState();
  const [draft, setDraft] = createSignal<PomodoroPreferencesDraft>(
    createDraft(pomodoro.state.preferences),
  );
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string>();
  const validation = createMemo(() => {
    const values = draft();

    return validatePomodoroPreferences({
      focusDurationMinutes: parseMinutes(values.focusDurationMinutes),
      shortBreakDurationMinutes: parseMinutes(values.shortBreakDurationMinutes),
      longBreakDurationMinutes: parseMinutes(values.longBreakDurationMinutes),
    });
  });
  const isBusy = () =>
    isSubmitting() ||
    pomodoro.state.status === 'loading' ||
    pomodoro.state.status === 'saving';

  createEffect(() => {
    if (!props.open) {
      return;
    }

    setDraft(createDraft(pomodoro.state.preferences));
    setSaveError(undefined);
  });

  const closeDialog = () => {
    if (isBusy()) {
      return;
    }

    if (pomodoro.state.error?.operation === 'save-preferences') {
      pomodoro.actions.clearError();
    }

    setSaveError(undefined);
    props.onClose();
  };

  const submitForm = async (event: SubmitEvent) => {
    event.preventDefault();

    if (isBusy()) {
      return;
    }

    const result = validation();

    if (!result.ok) {
      setSaveError('Corrige las duraciones indicadas antes de guardar.');
      return;
    }

    setIsSubmitting(true);
    setSaveError(undefined);
    let shouldClose = false;

    try {
      const saveResult = await pomodoro.actions.savePreferences(result.value);

      if (saveResult.ok) {
        shouldClose = true;
      } else {
        setSaveError(
          'No se pudieron guardar las preferencias. Tus cambios siguen aquí; inténtalo de nuevo.',
        );
      }
    } catch {
      setSaveError(
        'No se pudieron guardar las preferencias. Tus cambios siguen aquí; inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }

    if (shouldClose) {
      closeDialog();
    }
  };

  return (
    <UiDialog
      class="pomodoro-settings-dialog"
      open={props.open}
      showHeader={false}
      title="Configuración de Pomodoro"
      onClose={closeDialog}
    >
      <Show when={props.open}>
        <form
          aria-busy={isBusy()}
          class="pomodoro-settings-dialog__form"
          novalidate
          onSubmit={submitForm}
        >
          <header class="pomodoro-settings-dialog__header">
            <span aria-hidden="true" class="pomodoro-settings-dialog__icon">
              <AppIcon
                class="pomodoro-settings-dialog__icon-svg"
                name="proicons:settings"
              />
            </span>
            <div class="pomodoro-settings-dialog__heading">
              <h2 class="pomodoro-settings-dialog__title">
                Configuración de Pomodoro
              </h2>
              <p class="pomodoro-settings-dialog__description">
                Define la duración de cada tipo de bloque en minutos.
              </p>
            </div>
            <button
              aria-label="Cerrar configuración"
              class="pomodoro-settings-dialog__close"
              disabled={isBusy()}
              type="button"
              onClick={closeDialog}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <PomodoroDurationFields
            initialValue={pomodoro.state.preferences}
            onValuesChange={(nextDraft) => setDraft(nextDraft)}
          />

          <Show when={saveError()}>
            {(message) => (
              <p class="pomodoro-settings-dialog__error" role="alert">
                {message()}
              </p>
            )}
          </Show>

          <footer class="pomodoro-settings-dialog__actions">
            <button
              class="pomodoro-settings-dialog__button pomodoro-settings-dialog__button--secondary"
              disabled={isBusy()}
              type="button"
              onClick={closeDialog}
            >
              Cancelar
            </button>
            <button
              class="pomodoro-settings-dialog__button pomodoro-settings-dialog__button--primary"
              disabled={isBusy() || !validation().ok}
              type="submit"
            >
              {isSubmitting() ? 'Guardando…' : 'Guardar'}
            </button>
          </footer>
        </form>
      </Show>
    </UiDialog>
  );
}
