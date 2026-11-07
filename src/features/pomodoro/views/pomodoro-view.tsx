import './pomodoro-view.css';

import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js';

import PomodoroBlockIndicator from '@/features/pomodoro/components/pomodoro-block-indicator/pomodoro-block-indicator';
import PomodoroCircularProgress from '@/features/pomodoro/components/pomodoro-circular-progress/pomodoro-circular-progress';
import PomodoroCycleProgressIndicators from '@/features/pomodoro/components/pomodoro-cycle-progress-indicators/pomodoro-cycle-progress-indicators';
import PomodoroCountdownDisplay from '@/features/pomodoro/components/pomodoro-countdown-display/pomodoro-countdown-display';
import PomodoroCycleResetDialog from '@/features/pomodoro/components/pomodoro-cycle-reset-dialog/pomodoro-cycle-reset-dialog';
import PomodoroSettingsDialog from '@/features/pomodoro/components/pomodoro-settings-dialog/pomodoro-settings-dialog';
import { getPomodoroRemainingMs } from '@/features/pomodoro/domain/pomodoro-time';
import { usePomodoroState } from '@/features/pomodoro/state/pomodoro-context';
import AppIcon, { type IconName } from '@/shared/ui/ui-icon/ui-icon';

type PomodoroControl = {
  label: string;
  accessibleName: string;
  icon: IconName;
};

const VISUAL_COUNTDOWN_UPDATE_INTERVAL_MS = 1_000;

export default function PomodoroView() {
  const pomodoro = usePomodoroState();
  const [isActionPending, setIsActionPending] = createSignal(false);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [isCycleResetOpen, setIsCycleResetOpen] = createSignal(false);
  const [visualNowMs, setVisualNowMs] = createSignal(Date.now());
  const currentBlock = pomodoro.selectors.currentBlock;
  const cycleProgress = pomodoro.selectors.cycleProgress;
  const currentCycle = () => pomodoro.state.cycle;
  const isBusy = () =>
    isActionPending() ||
    pomodoro.state.status === 'loading' ||
    pomodoro.state.status === 'saving';
  const primaryControl = createMemo<PomodoroControl>(() => {
    switch (currentCycle()?.status ?? 'ready') {
      case 'ready':
        return {
          label: 'Iniciar',
          accessibleName: 'Iniciar bloque Pomodoro',
          icon: 'proicons:play',
        };
      case 'running':
        return {
          label: 'Pausar',
          accessibleName: 'Pausar bloque Pomodoro',
          icon: 'proicons:pause',
        };
      case 'paused':
        return {
          label: 'Reanudar',
          accessibleName: 'Reanudar bloque Pomodoro',
          icon: 'proicons:play',
        };
    }
  });
  const runAction = (action: () => Promise<unknown>) => {
    if (isBusy()) {
      return;
    }

    setIsActionPending(true);
    void action()
      .catch(() => undefined)
      .finally(() => setIsActionPending(false));
  };
  const activatePrimaryControl = () => {
    const cycle = currentCycle();

    if (cycle === undefined || isBusy()) {
      return;
    }

    switch (cycle.status) {
      case 'ready':
        runAction(() => pomodoro.actions.start());
        break;
      case 'running':
        runAction(() => pomodoro.actions.pause());
        break;
      case 'paused':
        runAction(() => pomodoro.actions.resume());
        break;
    }
  };
  const isResetBlockDisabled = () => {
    const cycle = currentCycle();

    return isBusy() || cycle === undefined || cycle.status === 'ready';
  };
  const resetBlock = () => {
    const cycle = currentCycle();

    if (
      cycle === undefined ||
      cycle.status === 'ready' ||
      isBusy()
    ) {
      return;
    }

    runAction(() => pomodoro.actions.resetBlock());
  };
  const activeFocusNumber = () => {
    const cycle = currentCycle();

    return cycle !== undefined &&
      cycle.status !== 'ready' &&
      cycle.currentBlock.type === 'focus'
      ? cycle.completedFocusCount + 1
      : undefined;
  };
  const remainingMs = createMemo(() => {
    const cycle = currentCycle();

    return cycle === undefined
      ? undefined
      : getPomodoroRemainingMs(cycle, visualNowMs());
  });

  createEffect(() => {
    if (currentCycle()?.status !== 'running') {
      return;
    }

    setVisualNowMs(Date.now());
    const intervalId = window.setInterval(
      () => setVisualNowMs(Date.now()),
      VISUAL_COUNTDOWN_UPDATE_INTERVAL_MS,
    );

    onCleanup(() => window.clearInterval(intervalId));
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
            disabled={isBusy() || currentCycle() === undefined}
            type="button"
            onClick={() => setIsSettingsOpen(true)}
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
            disabled={isBusy() || currentCycle() === undefined}
            type="button"
            onClick={() => setIsCycleResetOpen(true)}
          >
            <AppIcon
              class="pomodoro-view__action-icon"
              name="proicons:arrow-counterclockwise"
            />
            <span>Reiniciar ciclo</span>
          </button>
        </div>
      </header>

      <PomodoroSettingsDialog
        open={isSettingsOpen()}
        onClose={() => setIsSettingsOpen(false)}
      />
      <PomodoroCycleResetDialog
        open={isCycleResetOpen()}
        onClose={() => setIsCycleResetOpen(false)}
      />

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
          <div
            aria-busy={isBusy()}
            aria-label="Controles del bloque Pomodoro"
            class="pomodoro-view__control-group"
            role="group"
          >
            <button
              aria-label={primaryControl().accessibleName}
              class="pomodoro-view__control-button pomodoro-view__control-button--primary"
              disabled={isBusy() || currentCycle() === undefined}
              type="button"
              onClick={activatePrimaryControl}
            >
              <AppIcon
                class="pomodoro-view__control-icon"
                name={primaryControl().icon}
              />
              <span>{primaryControl().label}</span>
            </button>
            <button
              aria-label="Reiniciar bloque Pomodoro"
              class="pomodoro-view__control-button"
              disabled={isResetBlockDisabled()}
              type="button"
              onClick={resetBlock}
            >
              <AppIcon
                class="pomodoro-view__control-icon"
                name="proicons:arrow-counterclockwise"
              />
              <span>Reiniciar bloque</span>
            </button>
          </div>
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
          <PomodoroCycleProgressIndicators
            activeFocusNumber={activeFocusNumber()}
            completedFocusCount={cycleProgress().completedFocusCount}
            totalFocusCount={cycleProgress().totalFocusCount}
          />
        </section>
      </div>
    </section>
  );
}
