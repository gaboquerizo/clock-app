import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from 'solid-js';

import { useStopwatchState } from '@/features/stopwatch/state/stopwatch-context';
import StopwatchResetDialog from '@/features/stopwatch/components/stopwatch-reset-dialog/stopwatch-reset-dialog';
import AppIcon, { type IconName } from '@/shared/ui/ui-icon/ui-icon';

import { formatStopwatchElapsed } from './stopwatch-view.utils';

import './stopwatch-view.css';

type StopwatchControl = {
  label: string;
  accessibleName: string;
  icon: IconName;
  disabled?: boolean;
  activate: () => void;
};

export default function StopwatchView() {
  const stopwatch = useStopwatchState();
  const [now, setNow] = createSignal(Date.now());
  const [isResetDialogOpen, setIsResetDialogOpen] = createSignal(false);
  const [isActionPending, setIsActionPending] = createSignal(false);
  const elapsedMs = createMemo(() => {
    const result = stopwatch.selectors.elapsedAt(now());
    return result.ok ? result.value : 0;
  });
  const elapsedText = createMemo(() =>
    formatStopwatchElapsed(elapsedMs()),
  );
  const lapsNewestFirst = createMemo(() =>
    [...stopwatch.state.stopwatch.laps].reverse(),
  );
  const isBusy = () =>
    isActionPending() ||
    stopwatch.state.status === 'loading' ||
    stopwatch.state.status === 'saving';
  let primaryControlButton!: HTMLButtonElement;

  const runAction = (action: () => Promise<unknown>) => {
    if (isBusy()) {
      return;
    }

    setIsActionPending(true);
    void action()
      .catch(() => undefined)
      .finally(() => setIsActionPending(false));
  };

  const primaryControl = createMemo<StopwatchControl>(() => {
    switch (stopwatch.state.stopwatch.status) {
      case 'idle':
        return {
          label: 'Iniciar',
          accessibleName: 'Iniciar cronómetro',
          icon: 'proicons:play',
          activate: () => runAction(stopwatch.actions.start),
        };
      case 'running':
        return {
          label: 'Pausar',
          accessibleName: 'Pausar cronómetro',
          icon: 'proicons:pause',
          activate: () => runAction(stopwatch.actions.pause),
        };
      case 'paused':
        return {
          label: 'Reanudar',
          accessibleName: 'Reanudar cronómetro',
          icon: 'proicons:play',
          activate: () => runAction(stopwatch.actions.resume),
        };
    }
  });

  const secondaryControl = createMemo<StopwatchControl>(() => {
    switch (stopwatch.state.stopwatch.status) {
      case 'idle':
        return {
          label: 'Reiniciar',
          accessibleName: 'Reiniciar cronómetro',
          icon: 'proicons:arrow-counterclockwise',
          disabled: true,
          activate: () => undefined,
        };
      case 'running':
        return {
          label: 'Vuelta',
          accessibleName: 'Registrar vuelta',
          icon: 'proicons:flag',
          activate: () => runAction(stopwatch.actions.recordLap),
        };
      case 'paused':
        return {
          label: 'Reiniciar',
          accessibleName: 'Reiniciar cronómetro',
          icon: 'proicons:arrow-counterclockwise',
          activate: () => setIsResetDialogOpen(true),
        };
    }
  });

  const closeResetDialog = () => {
    setIsResetDialogOpen(false);

    if (stopwatch.state.stopwatch.status === 'idle') {
      window.requestAnimationFrame(() => {
        if (
          primaryControlButton.isConnected &&
          !primaryControlButton.disabled
        ) {
          primaryControlButton.focus();
        }
      });
    }
  };

  createEffect(() => {
    if (stopwatch.state.stopwatch.status !== 'running') {
      setNow(Date.now());
      return;
    }

    let animationFrameId: number;

    const updateTimestamp = () => {
      setNow(Date.now());
      animationFrameId = window.requestAnimationFrame(updateTimestamp);
    };

    updateTimestamp();

    onCleanup(() => {
      window.cancelAnimationFrame(animationFrameId);
    });
  });

  return (
    <section
      aria-labelledby="stopwatch-view-title"
      class="stopwatch-view"
    >
      <header class="stopwatch-view__header">
        <h1 class="stopwatch-view__title" id="stopwatch-view-title">
          Cronómetro
        </h1>
      </header>

      <div class="stopwatch-view__content">
        <section
          aria-labelledby="stopwatch-view-elapsed-title"
          class="stopwatch-view__region stopwatch-view__elapsed"
        >
          <h2
            class="stopwatch-view__region-title"
            id="stopwatch-view-elapsed-title"
          >
            Tiempo transcurrido
          </h2>
          <div
            aria-live="off"
            aria-labelledby="stopwatch-view-elapsed-title"
            class="stopwatch-view__elapsed-time"
            role="timer"
          >
            {elapsedText()}
          </div>
        </section>

        <section
          aria-labelledby="stopwatch-view-controls-title"
          class="stopwatch-view__region stopwatch-view__controls"
        >
          <h2
            class="stopwatch-view__region-title"
            id="stopwatch-view-controls-title"
          >
            Controles principales
          </h2>
          <div
            aria-busy={isBusy()}
            aria-label="Controles del cronómetro"
            class="stopwatch-view__control-group"
            role="group"
          >
            <button
              aria-label={primaryControl().accessibleName}
              class="stopwatch-view__control-button stopwatch-view__control-button--primary"
              disabled={isBusy()}
              ref={(element) => {
                primaryControlButton = element;
              }}
              type="button"
              onClick={() => primaryControl().activate()}
            >
              <AppIcon
                class="stopwatch-view__control-icon"
                name={primaryControl().icon}
              />
              <span>{primaryControl().label}</span>
            </button>
            <button
              aria-label={secondaryControl().accessibleName}
              class="stopwatch-view__control-button"
              disabled={isBusy() || secondaryControl().disabled === true}
              type="button"
              onClick={() => secondaryControl().activate()}
            >
              <AppIcon
                class="stopwatch-view__control-icon"
                name={secondaryControl().icon}
              />
              <span>{secondaryControl().label}</span>
            </button>
          </div>
          <Show
            when={
              stopwatch.state.error !== undefined &&
              stopwatch.state.error.operation !== 'reset'
            }
          >
            <p class="stopwatch-view__control-error" role="alert">
              {stopwatch.state.error?.message}
            </p>
          </Show>
        </section>

        <section
          aria-labelledby="stopwatch-view-laps-title"
          class="stopwatch-view__region stopwatch-view__laps"
        >
          <h2
            class="stopwatch-view__region-title"
            id="stopwatch-view-laps-title"
          >
            Vueltas
          </h2>
          <Show
            when={lapsNewestFirst().length > 0}
            fallback={(
              <p class="stopwatch-view__laps-empty">
                Aún no hay vueltas registradas.
              </p>
            )}
          >
            <div
              aria-label="Tabla de vueltas"
              class="stopwatch-view__laps-table-wrap"
              role="region"
              tabIndex={0}
            >
              <table class="stopwatch-view__laps-table">
                <caption class="stopwatch-view__visually-hidden">
                  Vueltas registradas del cronómetro
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Vuelta</th>
                    <th scope="col">Duración</th>
                    <th scope="col">Tiempo acumulado</th>
                    <th scope="col">Clasificación</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={lapsNewestFirst()}>
                    {(lap) => {
                      const classification = createMemo(() => {
                        const ranking = stopwatch.selectors.lapRanking();

                        if (ranking === undefined) {
                          return undefined;
                        }

                        if (ranking.fastestLapNumber === lap.number) {
                          return {
                            kind: 'fastest' as const,
                            label: 'Más rápido',
                          };
                        }

                        if (ranking.slowestLapNumber === lap.number) {
                          return {
                            kind: 'slowest' as const,
                            label: 'Más lento',
                          };
                        }

                        return undefined;
                      });

                      return (
                        <tr>
                          <th scope="row">Vuelta {lap.number}</th>
                          <td
                            classList={{
                              'stopwatch-view__lap-duration--fastest':
                                classification()?.kind === 'fastest',
                            }}
                          >
                            {formatStopwatchElapsed(lap.durationMs)}
                          </td>
                          <td>
                            {formatStopwatchElapsed(lap.elapsedMs)}
                          </td>
                          <td>
                            <Show when={classification()}>
                              {(result) => (
                                <span
                                  classList={{
                                    'stopwatch-view__lap-classification--fastest':
                                      result().kind === 'fastest',
                                    'stopwatch-view__lap-classification--slowest':
                                      result().kind === 'slowest',
                                  }}
                                >
                                  {result().label}
                                </span>
                              )}
                            </Show>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </section>
      </div>
      <StopwatchResetDialog
        busy={isBusy()}
        open={isResetDialogOpen()}
        onClose={closeResetDialog}
      />
    </section>
  );
}
