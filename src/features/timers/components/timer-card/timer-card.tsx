import { createMemo, type JSX } from 'solid-js';

import { getTimerRemainingMs } from '@/features/timers/domain/timer';
import type { Timer } from '@/features/timers/domain/timer.types';
import {
  describeTimerDuration,
  formatTimerDuration,
  getTimerProgress,
  getTimerStatusLabel,
  toTimerDurationDateTime,
} from './timer-card.utils';

import './timer-card.css';

type TimerCardProps = {
  now: number;
  timer: Timer;
  actions?: JSX.Element;
};

function getTimerLabel(timer: Timer): string {
  return timer.label.trim() || 'Temporizador';
}

const timerProgressCircumference = 2 * Math.PI * 64;

export default function TimerCard(props: TimerCardProps) {
  const remainingMs = createMemo(() =>
    getTimerRemainingMs(props.timer, props.now),
  );
  const progress = createMemo(() =>
    getTimerProgress(props.timer.durationMs, remainingMs()),
  );
  const progressPercent = () => Math.round(progress() * 100);
  const accessibleRemaining = () =>
    `${describeTimerDuration(remainingMs())} restantes`;
  const accessibleProgress = () => `${progressPercent()} % completado`;
  const label = () => getTimerLabel(props.timer);

  return (
    <article
      aria-label={`${label()}, ${getTimerStatusLabel(props.timer)}`}
      class={`timer-card timer-card--${props.timer.status}`}
      data-timer-id={props.timer.id}
    >
      <header class="timer-card__header">
        <h2 class="timer-card__label">{label()}</h2>
        <span class="timer-card__status">{getTimerStatusLabel(props.timer)}</span>
      </header>

      <div class="timer-card__reading">
        <span class="timer-card__reading-label">Tiempo restante</span>
        <div class="timer-card__dial">
          <svg
            aria-label={`Progreso de ${label()}`}
            aria-valuemax="100"
            aria-valuemin="0"
            aria-valuenow={progressPercent()}
            aria-valuetext={accessibleProgress()}
            class="timer-card__progress-ring"
            role="progressbar"
            viewBox="0 0 144 144"
          >
            <circle
              class="timer-card__progress-track"
              cx="72"
              cy="72"
              r="64"
            />
            <circle
              class="timer-card__progress-value"
              cx="72"
              cy="72"
              r="64"
              data-progress-visible={progress() > 0}
              stroke-dasharray={`${timerProgressCircumference}`}
              stroke-dashoffset={
                timerProgressCircumference * (1 - progress())
              }
            />
          </svg>
          <time
            aria-label={accessibleRemaining()}
            class="timer-card__remaining"
            datetime={toTimerDurationDateTime(remainingMs())}
          >
            {formatTimerDuration(remainingMs())}
          </time>
        </div>
      </div>

      <footer class="timer-card__footer">
        <span class="timer-card__duration-label">Duración</span>
        <time
          class="timer-card__duration"
          datetime={toTimerDurationDateTime(props.timer.durationMs)}
        >
          {formatTimerDuration(props.timer.durationMs)}
        </time>
        {props.actions}
      </footer>
    </article>
  );
}
