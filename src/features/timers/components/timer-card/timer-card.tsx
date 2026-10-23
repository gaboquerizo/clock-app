import { createMemo, type JSX } from 'solid-js';

import { getTimerRemainingMs } from '@/features/timers/domain/timer';
import type { Timer } from '@/features/timers/domain/timer.types';
import {
  describeTimerDuration,
  formatTimerDuration,
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

export default function TimerCard(props: TimerCardProps) {
  const remainingMs = createMemo(() =>
    getTimerRemainingMs(props.timer, props.now),
  );
  const accessibleRemaining = () =>
    `${describeTimerDuration(remainingMs())} restantes`;

  return (
    <article
      aria-label={`${getTimerLabel(props.timer)}, ${getTimerStatusLabel(props.timer)}`}
      class={`timer-card timer-card--${props.timer.status}`}
      data-timer-id={props.timer.id}
    >
      <header class="timer-card__header">
        <h2 class="timer-card__label">{getTimerLabel(props.timer)}</h2>
        <span class="timer-card__status">{getTimerStatusLabel(props.timer)}</span>
      </header>

      <div class="timer-card__reading">
        <span class="timer-card__reading-label">Tiempo restante</span>
        <time
          aria-label={accessibleRemaining()}
          class="timer-card__remaining"
          datetime={toTimerDurationDateTime(remainingMs())}
        >
          {formatTimerDuration(remainingMs())}
        </time>
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
