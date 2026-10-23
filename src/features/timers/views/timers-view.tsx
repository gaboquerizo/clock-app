import { createMemo, createSignal, For, Show } from 'solid-js';

import type {
  Timer,
  TimerTransition,
} from '@/features/timers/domain/timer.types';
import TimerCard from '@/features/timers/components/timer-card/timer-card';
import TimerDialog, {
  type TimerDialogValue,
} from '@/features/timers/components/timer-dialog/timer-dialog';
import { useTimersState } from '@/features/timers/state/timers-context';
import { useTimerNow } from '@/features/timers/state/use-timer-now';

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

function TimerList(props: {
  timers: Timer[];
  now: number;
  onEdit: (timer: Timer) => void;
  onPlaybackAction: (
    timerId: string,
    transition: TimerTransition,
  ) => Promise<void>;
  playbackPendingIds: ReadonlySet<string>;
  playbackErrors: Readonly<Record<string, string>>;
}) {
  return (
    <ul aria-label="Temporizadores configurados" class="timers-view__list">
      <For each={props.timers.map((timer) => timer.id)}>
        {(timerId) => {
          const timer = createMemo(
            () => props.timers.find((current) => current.id === timerId)!,
          );

          return (
            <li class="timers-view__list-item">
              <TimerCard
                now={props.now}
                onPlaybackAction={props.onPlaybackAction}
                playbackError={props.playbackErrors[timerId]}
                playbackPending={props.playbackPendingIds.has(timerId)}
                actions={
                  <button
                    aria-label={`Editar temporizador ${timer().label.trim() || 'Temporizador'}`}
                    class="timer-card__edit-button"
                    disabled={props.playbackPendingIds.has(timerId)}
                    type="button"
                    onClick={() => props.onEdit(timer())}
                  >
                    <AppIcon
                      aria-hidden="true"
                      class="timer-card__edit-icon"
                      name="proicons:edit"
                    />
                    <span>Editar</span>
                  </button>
                }
                timer={timer()}
              />
            </li>
          );
        }}
      </For>
    </ul>
  );
}

export default function TimersView() {
  const timers = useTimersState();
  const now = useTimerNow();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false);
  const [dialogMode, setDialogMode] = createSignal<'create' | 'edit'>('create');
  const [selectedTimer, setSelectedTimer] = createSignal<Timer>();
  const [isSaving, setIsSaving] = createSignal(false);
  const [dialogError, setDialogError] = createSignal<string>();
  const [playbackPendingIds, setPlaybackPendingIds] = createSignal<
    ReadonlySet<string>
  >(new Set());
  const [playbackErrors, setPlaybackErrors] = createSignal<
    Readonly<Record<string, string>>
  >({});
  let viewElement!: HTMLElement;
  const isLoading = () =>
    timers.state.status === 'idle' || timers.state.status === 'loading';
  const hasLoadError = () =>
    timers.state.status === 'error' && timers.state.error?.operation === 'load';

  const clearDialogError = () => {
    const hadDialogError = dialogError() !== undefined;
    setDialogError(undefined);

    if (hadDialogError && timers.state.status === 'error') {
      timers.actions.clearError();
    }
  };

  const openCreateDialog = () => {
    clearDialogError();
    setSelectedTimer(undefined);
    setDialogMode('create');
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (timer: Timer) => {
    clearDialogError();
    setSelectedTimer(timer);
    setDialogMode('edit');
    setIsCreateDialogOpen(true);
  };

  const saveTimer = async (value: TimerDialogValue) => {
    if (isSaving()) return;

    setIsSaving(true);
    setDialogError(undefined);

    try {
      const currentTimer = selectedTimer();
      const result =
        dialogMode() === 'edit' && currentTimer !== undefined
          ? await timers.actions.update(currentTimer.id, value)
          : await timers.actions.create(value);

      if (result.ok) {
        setIsCreateDialogOpen(false);
        setSelectedTimer(undefined);
        return;
      }

      const message =
        result.error.code === 'invalid-label'
          ? 'La etiqueta no es válida.'
          : result.error.code === 'duplicate-id'
            ? 'No se pudo asignar una identidad única. Inténtalo de nuevo.'
            : result.error.code === 'invalid-duration'
              ? 'La duración debe ser mayor que cero y estar dentro del rango permitido.'
              : result.error.code === 'not-found'
                ? 'El temporizador ya no está disponible.'
                : 'No se pudo guardar el temporizador. Inténtalo de nuevo.';

      setDialogError(message);
      timers.actions.clearError();
    } catch {
      setDialogError('No se pudo guardar el temporizador. Inténtalo de nuevo.');
      timers.actions.clearError();
    } finally {
      setIsSaving(false);
    }
  };

  const closeDialog = () => {
    if (isSaving()) return;
    setIsCreateDialogOpen(false);
    setSelectedTimer(undefined);
    clearDialogError();
  };

  const runPlaybackAction = async (
    timerId: string,
    transition: TimerTransition,
  ) => {
    if (playbackPendingIds().has(timerId)) return;

    setPlaybackPendingIds((current) => new Set(current).add(timerId));
    setPlaybackErrors((current) => {
      const next = { ...current };
      delete next[timerId];
      return next;
    });

    try {
      const result = await timers.actions[transition](timerId);

      if (!result.ok) {
        setPlaybackErrors((current) => ({
          ...current,
          [timerId]:
            result.error.code === 'invalid-transition'
              ? 'El temporizador cambió de estado. Actualiza la acción e inténtalo de nuevo.'
              : 'No se pudo actualizar el temporizador. Inténtalo de nuevo.',
        }));
        timers.actions.clearError();
      }
    } catch {
      setPlaybackErrors((current) => ({
        ...current,
        [timerId]: 'No se pudo actualizar el temporizador. Inténtalo de nuevo.',
      }));
      timers.actions.clearError();
    } finally {
      setPlaybackPendingIds((current) => {
        const next = new Set(current);
        next.delete(timerId);
        return next;
      });
    }
  };

  const deleteTimer = async (timerId: string) => {
    if (isSaving() || selectedTimer()?.id !== timerId) return;

    setIsSaving(true);
    clearDialogError();

    try {
      const result = await timers.actions.remove(timerId);

      if (result.ok) {
        setIsCreateDialogOpen(false);
        setSelectedTimer(undefined);
        queueMicrotask(() => {
          const nextEditButton =
            viewElement.querySelector<HTMLButtonElement>(
              '.timer-card__edit-button',
            );
          const addButton = viewElement.querySelector<HTMLButtonElement>(
            '.timers-view__add-button',
          );

          (nextEditButton ?? addButton ?? viewElement).focus();
        });
        return;
      }

      setDialogError(
        result.error.code === 'not-found'
          ? 'El temporizador ya no está disponible.'
          : 'No se pudo eliminar el temporizador. Inténtalo de nuevo.',
      );
      timers.actions.clearError();
    } catch {
      setDialogError('No se pudo eliminar el temporizador. Inténtalo de nuevo.');
      timers.actions.clearError();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="timers-view-title"
      class="timers-view"
      ref={viewElement}
      tabIndex={-1}
    >
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
              <TimerList
                now={now()}
                onPlaybackAction={runPlaybackAction}
                onEdit={openEditDialog}
                playbackErrors={playbackErrors()}
                playbackPendingIds={playbackPendingIds()}
                timers={timers.state.timers}
              />
            </Show>
          </Show>
        </div>
      </div>
      <TimerDialog
        busy={isSaving()}
        error={dialogError()}
        mode={dialogMode()}
        open={isCreateDialogOpen()}
        timer={selectedTimer()}
        onCancelDelete={clearDialogError}
        onClose={closeDialog}
        onConfirmDelete={deleteTimer}
        onSubmit={saveTimer}
      />
    </section>
  );
}
