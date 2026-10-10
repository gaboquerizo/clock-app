/*—————————— Styles ——————————*/
import './clock-view.css';

import { useLocalClock } from '../state/use-local-clock';

export default function ClockView() {
  const localTime = useLocalClock();

  return (
    <section aria-labelledby="clock-view-title" class="clock-view">
      <h1 class="clock-view__title" id="clock-view-title">
        Reloj
      </h1>
      <div class="clock-view__display">
        <time
          aria-label={`Hora local: ${localTime()}`}
          class="clock-view__time"
          datetime={localTime()}
        >
          {localTime()}
        </time>
      </div>
    </section>
  );
}
