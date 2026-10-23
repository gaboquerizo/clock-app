import { createMemo, Show, type JSX } from 'solid-js';

import { getTimerRemainingMs } from '@/features/timers/domain/timer';
import type {
  Timer,
  TimerStatus,
  TimerTransition,
} from '@/features/timers/domain/timer.types';
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
  playbackError?: string;
  playbackPending: boolean;
  onPlaybackAction: (
    timerId: string,
    transition: TimerTransition,
  ) => Promise<void>;
};

type PlaybackAction = {
  transition: TimerTransition;
  label: string;
};

const primaryPlaybackActionByStatus: Record<TimerStatus, PlaybackAction> = {
  ready: { transition: 'start', label: 'Iniciar' },
  running: { transition: 'pause', label: 'Pausar' },
  paused: { transition: 'resume', label: 'Reanudar' },
  completed: { transition: 'restart', label: 'Reiniciar' },
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
  const primaryPlaybackAction = () =>
    primaryPlaybackActionByStatus[props.timer.status];
  const canRestartInCurrentState = () =>
    props.timer.status === 'running' || props.timer.status === 'paused';

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
        <div class="timer-card__duration-group">
          <span class="timer-card__duration-label">Duración</span>
          <time
            class="timer-card__duration"
            datetime={toTimerDurationDateTime(props.timer.durationMs)}
          >
            {formatTimerDuration(props.timer.durationMs)}
          </time>
        </div>
        {props.actions}
        <div
          aria-busy={props.playbackPending}
          aria-label={`Controles del temporizador ${label()}`}
          class="timer-card__playback-controls"
          role="group"
        >
          <button
            aria-disabled={props.playbackPending}
            aria-label={`${primaryPlaybackAction().label} temporizador ${label()}`}
            class="timer-card__playback-button timer-card__playback-button--primary"
            type="button"
            onClick={() =>
              props.onPlaybackAction(
                props.timer.id,
                primaryPlaybackAction().transition,
              )
            }
          >
            {primaryPlaybackAction().label}
          </button>
          <Show when={canRestartInCurrentState()}>
            <button
              aria-disabled={props.playbackPending}
              aria-label={`Reiniciar temporizador ${label()}`}
              class="timer-card__playback-button"
              type="button"
              onClick={() =>
                props.onPlaybackAction(props.timer.id, 'restart')
              }
            >
              Reiniciar
            </button>
          </Show>
        </div>
        {props.playbackError && (
          <p class="timer-card__playback-error" role="alert">
            {props.playbackError}
          </p>
        )}
      </footer>
    </article>
  );
}
