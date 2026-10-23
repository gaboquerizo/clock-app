import { createSignal, For, Show } from 'solid-js';

import type { Timer } from '@/features/timers/domain/timer.types';
import TimerCard from '@/features/timers/components/timer-card/timer-card';
import TimerDialog, {
  type TimerDialogValue,
} from '@/features/timers/components/timer-dialog/timer-dialog';
import { useTimersState } from '@/features/timers/state/timers-context';

import './timers-view.css';

import AppIcon from '@/shared/ui/ui-icon/ui-icon';
import UiEmptyState from '@/shared/ui/ui-empty-state/ui-empty-state';

function AddTimerButton(props: { onClick: () => void }) {
  return (
    <button class="timers-view__add-button" type="button" onClick={props.onClick}>
      <AppIcon class="timers-view__add-icon" name="proicons:add" />
      <span>Añadir temporizador</span>
    </button>
  );
}

function TimerList(props: { timers: Timer[] }) {
  return (
    <ul aria-label="Temporizadores configurados" class="timers-view__list">
      <For each={props.timers}>
        {(timer) => (
          <li class="timers-view__list-item">
            <TimerCard timer={timer} />
          </li>
        )}
      </For>
    </ul>
  );
}

export default function TimersView() {
  const timers = useTimersState();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);
  const [creationError, setCreationError] = createSignal<string>();
  const isLoading = () =>
    timers.state.status === 'idle' || timers.state.status === 'loading';
  const hasLoadError = () =>
    timers.state.status === 'error' && timers.state.error?.operation === 'load';

  const openCreateDialog = () => {
    setCreationError(undefined);
    setIsCreateDialogOpen(true);
  };

  const createTimer = async (value: TimerDialogValue) => {
    if (isCreating()) return;

    setIsCreating(true);
    setCreationError(undefined);

    try {
      const result = await timers.actions.create(value);

      if (result.ok) {
        setIsCreateDialogOpen(false);
        return;
      }

      const message =
        result.error.code === 'invalid-label'
          ? 'La etiqueta no es válida.'
          : result.error.code === 'duplicate-id'
            ? 'No se pudo asignar una identidad única. Inténtalo de nuevo.'
            : result.error.code === 'invalid-duration'
              ? 'La duración debe ser mayor que cero y estar dentro del rango permitido.'
              : 'No se pudo guardar el temporizador. Inténtalo de nuevo.';

      setCreationError(message);
      timers.actions.clearError();
    } catch {
      setCreationError('No se pudo guardar el temporizador. Inténtalo de nuevo.');
      timers.actions.clearError();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section aria-labelledby="timers-view-title" class="timers-view">
      <header class="timers-view__header">
        <h1 class="timers-view__title" id="timers-view-title">
          Temporizador
        </h1>
        <Show when={timers.state.timers.length > 0}>
          <AddTimerButton onClick={openCreateDialog} />
        </Show>
      </header>

      <div class="timers-view__content">
        <div class="timers-view__content-body">
          <Show
            when={!isLoading() && !hasLoadError()}
            fallback={
              <Show
                when={hasLoadError()}
                fallback={
                  <p aria-live="polite" class="timers-view__message">
                    Cargando temporizadores...
                  </p>
                }
              >
                <p aria-live="assertive" class="timers-view__message" role="alert">
                  No se pudieron cargar los temporizadores.
                </p>
              </Show>
            }
          >
            <Show
              when={timers.state.timers.length > 0}
              fallback={
                <UiEmptyState
                  description="Crea tu primer temporizador con el botón «Añadir temporizador»."
                  icon="proicons:timer"
                  title="No tienes temporizadores todavía."
                >
                  <AddTimerButton onClick={openCreateDialog} />
                </UiEmptyState>
              }
            >
              <TimerList timers={timers.state.timers} />
            </Show>
          </Show>
        </div>
      </div>
      <TimerDialog
        busy={isCreating()}
        error={creationError()}
        mode="create"
        open={isCreateDialogOpen()}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={createTimer}
      />
    </section>
  );
}
