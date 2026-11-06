import './pomodoro-circular-progress.css';

import { getPomodoroRemainingRatio } from './pomodoro-circular-progress.utils';

type PomodoroCircularProgressProps = {
  durationMs: number;
  remainingMs: number;
};

const CIRCULAR_PROGRESS_RADIUS = 88;
const CIRCULAR_PROGRESS_CIRCUMFERENCE =
  2 * Math.PI * CIRCULAR_PROGRESS_RADIUS;

export default function PomodoroCircularProgress(
  props: PomodoroCircularProgressProps,
) {
  const remainingRatio = () =>
    getPomodoroRemainingRatio(props.durationMs, props.remainingMs);
  const remainingPercent = () => Math.round(remainingRatio() * 100);

  return (
    <svg
      aria-label="Tiempo restante del bloque actual"
      aria-valuemax="100"
      aria-valuemin="0"
      aria-valuenow={remainingPercent()}
      aria-valuetext={`${remainingPercent()} % de tiempo restante`}
      class="pomodoro-circular-progress"
      role="progressbar"
      viewBox="0 0 200 200"
    >
      <circle
        class="pomodoro-circular-progress__track"
        cx="100"
        cy="100"
        r={CIRCULAR_PROGRESS_RADIUS}
      />
      <circle
        class="pomodoro-circular-progress__value"
        cx="100"
        cy="100"
        r={CIRCULAR_PROGRESS_RADIUS}
        stroke-dasharray={`${CIRCULAR_PROGRESS_CIRCUMFERENCE}`}
        stroke-dashoffset={
          CIRCULAR_PROGRESS_CIRCUMFERENCE * (1 - remainingRatio())
        }
      />
    </svg>
  );
}
