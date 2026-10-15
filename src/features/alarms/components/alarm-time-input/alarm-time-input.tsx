/*—————————— Library ——————————*/
import { createSignal, createUniqueId } from 'solid-js';

/*—————————— Components ——————————*/
import AppIcon from '../../../../shared/ui/ui-icon/ui-icon';

/*—————————— Styles ——————————*/
import './alarm-time-input.css';

type TimeUnit = 'hours' | 'minutes';

type AlarmTimeInputProps = {
  initialValue?: string;
  onChange?: (value: string) => void;
};

type ParsedTime = {
  hours: number;
  minutes: number;
};

const hoursMaximum = 23;
const minutesMaximum = 59;

function parseInitialValue(value: string | undefined): ParsedTime {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');

  if (match === null) {
    return { hours: 0, minutes: 0 };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > hoursMaximum || minutes > minutesMaximum) {
    return { hours: 0, minutes: 0 };
  }

  return { hours, minutes };
}

function formatUnit(value: number): string {
  return String(value).padStart(2, '0');
}

function getMaximum(unit: TimeUnit): number {
  return unit === 'hours' ? hoursMaximum : minutesMaximum;
}

function clamp(value: number, maximum: number): number {
  return Math.min(Math.max(value, 0), maximum);
}

export default function AlarmTimeInput(props: AlarmTimeInputProps) {
  const initialTime = parseInitialValue(props.initialValue);
  const [hours, setHours] = createSignal(initialTime.hours);
  const [minutes, setMinutes] = createSignal(initialTime.minutes);
  const [hoursDraft, setHoursDraft] = createSignal(formatUnit(initialTime.hours));
  const [minutesDraft, setMinutesDraft] = createSignal(formatUnit(initialTime.minutes));
  const hoursId = `alarm-time-hours-${createUniqueId()}`;
  const minutesId = `alarm-time-minutes-${createUniqueId()}`;

  const getValue = () => `${formatUnit(hours())}:${formatUnit(minutes())}`;

  const notifyChange = () => {
    props.onChange?.(getValue());
  };

  const getUnitValue = (unit: TimeUnit): number => {
    const draft = unit === 'hours' ? hoursDraft() : minutesDraft();
    const maximum = getMaximum(unit);
    const value = Number(draft);

    return draft.length > 0 && value <= maximum ? value : unit === 'hours' ? hours() : minutes();
  };

  const setUnitValue = (unit: TimeUnit, value: number) => {
    const normalizedValue = clamp(value, getMaximum(unit));

    if (unit === 'hours') {
      setHours(normalizedValue);
      setHoursDraft(formatUnit(normalizedValue));
    } else {
      setMinutes(normalizedValue);
      setMinutesDraft(formatUnit(normalizedValue));
    }
  };

  const commit = (unit: TimeUnit) => {
    setUnitValue(unit, getUnitValue(unit));
    notifyChange();
  };

  const updateDraft = (unit: TimeUnit, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '').slice(0, 2);
    const maximum = getMaximum(unit);

    if (unit === 'hours') {
      setHoursDraft(digits);
    } else {
      setMinutesDraft(digits);
    }

    if (digits.length !== 2) {
      return;
    }

    setUnitValue(unit, clamp(Number(digits), maximum));
    notifyChange();
  };

  const step = (unit: TimeUnit, direction: 1 | -1) => {
    const maximum = getMaximum(unit);
    const nextValue = (getUnitValue(unit) + direction + maximum + 1) % (maximum + 1);

    setUnitValue(unit, nextValue);
    notifyChange();
  };

  const handleKeyDown = (unit: TimeUnit, event: KeyboardEvent) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(unit, 1);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(unit, -1);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commit(unit);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setUnitValue(unit, getUnitValue(unit));
    }
  };

  return (
    <fieldset aria-label="Hora de la alarma" class="alarm-time-input">
      <legend class="alarm-time-input__legend">Hora de la alarma</legend>

      <div class="alarm-time-input__unit">
        <button
          aria-label="Incrementar horas"
          class="alarm-time-input__step"
          type="button"
          onClick={() => step('hours', 1)}
        >
          <AppIcon class="alarm-time-input__step-icon" name="proicons:chevron-up" />
        </button>
        <label class="alarm-time-input__field-label" for={hoursId}>
          <span class="alarm-time-input__visually-hidden">Horas</span>
          <input
            aria-valuemax={hoursMaximum}
            aria-valuemin="0"
            aria-valuenow={getUnitValue('hours')}
            class="alarm-time-input__field"
            id={hoursId}
            inputmode="numeric"
            maxlength="2"
            role="spinbutton"
            type="text"
            value={hoursDraft()}
            onBlur={() => commit('hours')}
            onFocus={(event) => event.currentTarget.select()}
            onInput={(event) => updateDraft('hours', event.currentTarget.value)}
            onKeyDown={(event) => handleKeyDown('hours', event)}
          />
        </label>
        <button
          aria-label="Disminuir horas"
          class="alarm-time-input__step"
          type="button"
          onClick={() => step('hours', -1)}
        >
          <AppIcon class="alarm-time-input__step-icon" name="proicons:chevron-down" />
        </button>
      </div>

      <span aria-hidden="true" class="alarm-time-input__separator">
        :
      </span>

      <div class="alarm-time-input__unit">
        <button
          aria-label="Incrementar minutos"
          class="alarm-time-input__step"
          type="button"
          onClick={() => step('minutes', 1)}
        >
          <AppIcon class="alarm-time-input__step-icon" name="proicons:chevron-up" />
        </button>
        <label class="alarm-time-input__field-label" for={minutesId}>
          <span class="alarm-time-input__visually-hidden">Minutos</span>
          <input
            aria-valuemax={minutesMaximum}
            aria-valuemin="0"
            aria-valuenow={getUnitValue('minutes')}
            class="alarm-time-input__field"
            id={minutesId}
            inputmode="numeric"
            maxlength="2"
            role="spinbutton"
            type="text"
            value={minutesDraft()}
            onBlur={() => commit('minutes')}
            onFocus={(event) => event.currentTarget.select()}
            onInput={(event) => updateDraft('minutes', event.currentTarget.value)}
            onKeyDown={(event) => handleKeyDown('minutes', event)}
          />
        </label>
        <button
          aria-label="Disminuir minutos"
          class="alarm-time-input__step"
          type="button"
          onClick={() => step('minutes', -1)}
        >
          <AppIcon class="alarm-time-input__step-icon" name="proicons:chevron-down" />
        </button>
      </div>
    </fieldset>
  );
}
