import './pomodoro-countdown-display.css';

import { formatPomodoroCountdown } from './pomodoro-countdown-display.utils';

type PomodoroCountdownDisplayProps = {
  assignedDurationMs: number;
  remainingMs: number;
};

export default function PomodoroCountdownDisplay(
  props: PomodoroCountdownDisplayProps,
) {
  const formattedRemaining = () =>
    formatPomodoroCountdown(props.remainingMs, props.assignedDurationMs);

  return (
    <div
      aria-live="off"
      aria-labelledby="pomodoro-view-timer-title"
      class="pomodoro-countdown-display"
      role="timer"
    >
      {formattedRemaining()}
    </div>
  );
}
