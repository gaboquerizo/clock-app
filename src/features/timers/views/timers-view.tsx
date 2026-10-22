import { For, Show } from 'solid-js';

import type { Timer } from '@/features/timers/domain/timer.types';
import TimerCard from '@/features/timers/components/timer-card/timer-card';
import { useTimersState } from '@/features/timers/state/timers-context';

import './timers-view.css';

import AppIcon from '@/shared/ui/ui-icon/ui-icon';
import UiEmptyState from '@/shared/ui/ui-empty-state/ui-empty-state';

function AddTimerButton() {
  return (
    <button class="timers-view__add-button" type="button">
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
  const isLoading = () =>
    timers.state.status === 'idle' || timers.state.status === 'loading';
  const hasLoadError = () =>
    timers.state.status === 'error' && timers.state.error?.operation === 'load';

  return (
    <section aria-labelledby="timers-view-title" class="timers-view">
      <header class="timers-view__header">
        <h1 class="timers-view__title" id="timers-view-title">
          Temporizador
        </h1>
        <Show when={timers.state.timers.length > 0}>
          <AddTimerButton />
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
                  <AddTimerButton />
                </UiEmptyState>
              }
            >
              <TimerList timers={timers.state.timers} />
            </Show>
          </Show>
        </div>
      </div>
    </section>
  );
}
