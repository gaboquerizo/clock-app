/*—————————— Styles ——————————*/
import './clock-view.css';

/*—————————— Functions ——————————*/
import { useLocalClock } from '../state/use-local-clock';

export default function ClockView() {
  const localClock = useLocalClock();

  return (
    <section aria-labelledby="clock-view-title" class="clock-view">
      <h1 class="clock-view__title" id="clock-view-title">
        Reloj
      </h1>
      <div class="clock-view__display">
        <time
          aria-label={`Hora local: ${localClock().time}`}
          class="clock-view__time"
          datetime={localClock().time}
        >
          {localClock().time}
        </time>
        <dl class="clock-view__timezone">
          <div class="clock-view__timezone-item">
            <dt>Zona horaria del dispositivo</dt>
            <dd>{localClock().timeZone}</dd>
          </div>
          <div class="clock-view__timezone-item">
            <dt>Desplazamiento</dt>
            <dd>{localClock().gmtOffset}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
