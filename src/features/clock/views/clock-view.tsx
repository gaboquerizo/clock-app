/*—————————— Styles ——————————*/
import './clock-view.css';

/*—————————— Functions ——————————*/
import { useLocalClock } from '../state/use-local-clock';
import AppIcon from '../../../shared/ui/ui-icon/ui-icon';

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
        <div class="clock-view__context">
          <div
            aria-label="Información de zona horaria"
            class="clock-view__timezone"
          >
            <div class="clock-view__timezone-item">
              <AppIcon class="clock-view__timezone-icon" name="proicons:globe" />
              <div class="clock-view__timezone-content">
                <span class="clock-view__timezone-value">
                  {localClock().timeZone}
                </span>
              </div>
            </div>
            <div class="clock-view__timezone-item">
              <AppIcon class="clock-view__timezone-icon" name="proicons:clock" />
              <div class="clock-view__timezone-content">
                <span class="clock-view__timezone-value">
                  {localClock().gmtOffset}
                </span>
              </div>
            </div>
          </div>
          <time
            aria-label={`Fecha local: ${localClock().date}`}
            class="clock-view__date"
            datetime={localClock().dateTime}
          >
            <AppIcon class="clock-view__date-icon" name="proicons:calendar" />
            <span class="clock-view__date-text">{localClock().date}</span>
          </time>
        </div>
      </div>
    </section>
  );
}
