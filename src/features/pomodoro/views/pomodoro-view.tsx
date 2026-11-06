import './pomodoro-view.css';

import { createMemo, Show } from 'solid-js';

import PomodoroBlockIndicator from '@/features/pomodoro/components/pomodoro-block-indicator/pomodoro-block-indicator';
import PomodoroCircularProgress from '@/features/pomodoro/components/pomodoro-circular-progress/pomodoro-circular-progress';
import PomodoroCountdownDisplay from '@/features/pomodoro/components/pomodoro-countdown-display/pomodoro-countdown-display';
import { getPomodoroRemainingMs } from '@/features/pomodoro/components/pomodoro-countdown-display/pomodoro-countdown-display.utils';
import { usePomodoroState } from '@/features/pomodoro/state/pomodoro-context';
import AppIcon from '@/shared/ui/ui-icon/ui-icon';

export default function PomodoroView() {
  const pomodoro = usePomodoroState();
  const currentBlock = pomodoro.selectors.currentBlock;
  const currentCycle = () => pomodoro.state.cycle;
  const remainingMs = createMemo(() => {
    const cycle = currentCycle();

    return cycle === undefined
      ? undefined
      : getPomodoroRemainingMs(cycle, Date.now());
  });

  return (
    <section aria-labelledby="pomodoro-view-title" class="pomodoro-view">
      <header class="pomodoro-view__header">
        <h1 class="pomodoro-view__title" id="pomodoro-view-title">
          Pomodoro
        </h1>
        <div class="pomodoro-view__actions">
          <button
            aria-label="Configuración"
            class="pomodoro-view__action"
            disabled
            type="button"
          >
            <AppIcon
              class="pomodoro-view__action-icon"
              name="proicons:settings"
            />
            <span>Configuración</span>
          </button>
          <button
            aria-label="Reiniciar ciclo"
            class="pomodoro-view__action"
            disabled
            type="button"
          >
            <AppIcon
              class="pomodoro-view__action-icon"
              name="proicons:arrow-counterclockwise"
            />
            <span>Reiniciar ciclo</span>
          </button>
        </div>
      </header>

      <div class="pomodoro-view__content">
        <section
          aria-labelledby="pomodoro-view-timer-title"
          class="pomodoro-view__region pomodoro-view__timer"
        >
          <h2
            class="pomodoro-view__region-title"
            id="pomodoro-view-timer-title"
          >
            Tiempo restante
          </h2>
          <Show when={currentBlock()}>
            {(block) => <PomodoroBlockIndicator blockType={block().type} />}
          </Show>
          <Show when={currentCycle()}>
            {(cycle) => (
              <div class="pomodoro-view__dial">
                <PomodoroCircularProgress
                  durationMs={cycle().currentBlock.durationMs}
                  remainingMs={remainingMs() ?? 0}
                />
                <PomodoroCountdownDisplay
                  assignedDurationMs={cycle().currentBlock.durationMs}
                  remainingMs={remainingMs() ?? 0}
                />
              </div>
            )}
          </Show>
        </section>

        <section
          aria-labelledby="pomodoro-view-controls-title"
          class="pomodoro-view__region pomodoro-view__controls"
        >
          <h2
            class="pomodoro-view__region-title"
            id="pomodoro-view-controls-title"
          >
            Controles
          </h2>
        </section>

        <section
          aria-labelledby="pomodoro-view-cycle-title"
          class="pomodoro-view__region pomodoro-view__cycle"
        >
          <h2
            class="pomodoro-view__region-title"
            id="pomodoro-view-cycle-title"
          >
            Progreso del ciclo
          </h2>
        </section>
      </div>
    </section>
  );
}
