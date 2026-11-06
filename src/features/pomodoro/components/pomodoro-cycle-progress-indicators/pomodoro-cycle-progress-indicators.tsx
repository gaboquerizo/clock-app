import './pomodoro-cycle-progress-indicators.css';

import { For } from 'solid-js';

type FocusIndicatorState = 'completed' | 'in-progress' | 'pending';

type PomodoroCycleProgressIndicatorsProps = {
  activeFocusNumber: number | undefined;
  completedFocusCount: number;
  totalFocusCount: number;
};

const FOCUS_STATE_LABELS: Record<FocusIndicatorState, string> = {
  completed: 'Completa',
  'in-progress': 'En curso',
  pending: 'Pendiente',
};

export default function PomodoroCycleProgressIndicators(
  props: PomodoroCycleProgressIndicatorsProps,
) {
  const focusNumbers = () =>
    Array.from({ length: props.totalFocusCount }, (_, index) => index + 1);

  const getFocusState = (focusNumber: number): FocusIndicatorState => {
    if (focusNumber <= props.completedFocusCount) {
      return 'completed';
    }

    if (focusNumber === props.activeFocusNumber) {
      return 'in-progress';
    }

    return 'pending';
  };

  return (
    <div
      aria-labelledby="pomodoro-cycle-progress-title"
      class="pomodoro-cycle-progress-indicators"
    >
      <header class="pomodoro-cycle-progress-indicators__header">
        <h3
          class="pomodoro-cycle-progress-indicators__title"
          id="pomodoro-cycle-progress-title"
        >
          Concentraciones
        </h3>
        <p
          aria-label={`${props.completedFocusCount} de ${props.totalFocusCount} concentraciones completadas`}
          class="pomodoro-cycle-progress-indicators__count"
        >
          <span aria-hidden="true">
            {props.completedFocusCount}/{props.totalFocusCount}
          </span>
          <span>completadas</span>
        </p>
      </header>

      <ol
        aria-label="Estado de las concentraciones"
        class="pomodoro-cycle-progress-indicators__list"
      >
        <For each={focusNumbers()}>
          {(focusNumber) => {
            const state = () => getFocusState(focusNumber);

            return (
              <li
                aria-current={state() === 'in-progress' ? 'step' : undefined}
                class="pomodoro-cycle-progress-indicators__item"
                data-state={state()}
              >
                <span
                  aria-hidden="true"
                  class="pomodoro-cycle-progress-indicators__number"
                >
                  {focusNumber}
                </span>
                <span class="pomodoro-cycle-progress-indicators__state">
                  {FOCUS_STATE_LABELS[state()]}
                </span>
              </li>
            );
          }}
        </For>
      </ol>
    </div>
  );
}
