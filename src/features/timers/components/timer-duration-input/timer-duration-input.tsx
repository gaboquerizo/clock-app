import { createMemo, createSignal, createUniqueId } from 'solid-js';

import {
  formatTimerDurationField,
  getTimerDurationFields,
  parseTimerDuration,
  type TimerDurationField,
  type TimerDurationFields,
} from './timer-duration-input.utils';

import './timer-duration-input.css';

type TimerDurationInputProps = {
  initialValueMs?: number;
  onValueChange: (durationMs: number | undefined) => void;
};

const fieldLabels: Record<TimerDurationField, string> = {
  hours: 'Horas',
  minutes: 'Minutos',
  seconds: 'Segundos',
};

export default function TimerDurationInput(props: TimerDurationInputProps) {
  const initialFields = getTimerDurationFields(props.initialValueMs);
  const [hours, setHours] = createSignal(initialFields.hours);
  const [minutes, setMinutes] = createSignal(initialFields.minutes);
  const [seconds, setSeconds] = createSignal(initialFields.seconds);
  const [touched, setTouched] = createSignal(false);
  const id = createUniqueId();
  const errorId = `timer-duration-error-${id}`;

  const fields = (): TimerDurationFields => ({
    hours: hours(),
    minutes: minutes(),
    seconds: seconds(),
  });
  const validation = createMemo(() => parseTimerDuration(fields()));
  const validationError = createMemo(() => {
    const result = validation();

    return touched() && !result.ok ? result.message : undefined;
  });
  const showError = () => validationError() !== undefined;

  const getValue = (field: TimerDurationField) => {
    switch (field) {
      case 'hours':
        return hours();
      case 'minutes':
        return minutes();
      case 'seconds':
        return seconds();
    }
  };

  const setValue = (field: TimerDurationField, value: string) => {
    switch (field) {
      case 'hours':
        setHours(value);
        break;
      case 'minutes':
        setMinutes(value);
        break;
      case 'seconds':
        setSeconds(value);
        break;
    }
  };

  const notifyValueChange = () => {
    const result = validation();
    props.onValueChange(result.ok ? result.durationMs : undefined);
  };

  const handleInput = (field: TimerDurationField, value: string) => {
    setTouched(true);
    setValue(field, value);
    notifyValueChange();
  };

  const handleBlur = (field: TimerDurationField) => {
    const currentValue = getValue(field);

    if (/^\d{1,2}$/.test(currentValue)) {
      setValue(field, formatTimerDurationField(Number(currentValue)));
    }
  };

  const getFieldMaximum = (field: TimerDurationField) =>
    field === 'hours' ? 99 : 59;

  const isFieldInvalid = (field: TimerDurationField) => {
    const result = validation();

    return (
      showError() &&
      !result.ok &&
      (result.field === field || result.field === undefined)
    );
  };

  const renderField = (field: TimerDurationField) => {
    const inputId = `timer-duration-${field}-${id}`;
    const rangeId = `timer-duration-${field}-range-${id}`;
    const maximum = getFieldMaximum(field);

    return (
      <label class="timer-duration-input__unit" for={inputId}>
        <span class="timer-duration-input__label">{fieldLabels[field]}</span>
        <input
          aria-describedby={`${rangeId}${showError() ? ` ${errorId}` : ''}`}
          aria-invalid={isFieldInvalid(field)}
          autocomplete="off"
          class="timer-duration-input__field"
          id={inputId}
          inputmode="numeric"
          maxlength="3"
          name={field}
          pattern="[0-9]*"
          required
          type="text"
          value={getValue(field)}
          onBlur={() => handleBlur(field)}
          onFocus={(event) => event.currentTarget.select()}
          onInput={(event) => handleInput(field, event.currentTarget.value)}
        />
        <span class="timer-duration-input__range" id={rangeId}>
          00–{formatTimerDurationField(maximum)}
        </span>
      </label>
    );
  };

  return (
    <fieldset class="timer-duration-input">
      <legend class="timer-duration-input__legend">
        Duración del temporizador
      </legend>
      <div class="timer-duration-input__fields">
        {renderField('hours')}
        <span aria-hidden="true" class="timer-duration-input__separator">
          :
        </span>
        {renderField('minutes')}
        <span aria-hidden="true" class="timer-duration-input__separator">
          :
        </span>
        {renderField('seconds')}
      </div>
      {validationError() !== undefined ? (
        <p aria-live="polite" class="timer-duration-input__error" id={errorId}>
          {validationError()}
        </p>
      ) : undefined}
    </fieldset>
  );
}
