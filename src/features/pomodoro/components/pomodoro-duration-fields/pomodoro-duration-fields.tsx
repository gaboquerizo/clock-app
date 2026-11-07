import './pomodoro-duration-fields.css';

import { createMemo, createSignal, createUniqueId, For, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';

import {
  DEFAULT_POMODORO_PREFERENCES,
  MAX_POMODORO_DURATION_MINUTES,
  MIN_POMODORO_DURATION_MINUTES,
  validatePomodoroPreferences,
} from '@/features/pomodoro/domain/pomodoro-preferences';
import type {
  PomodoroPreferenceField,
  PomodoroPreferences,
} from '@/features/pomodoro/domain/pomodoro.types';

export type PomodoroPreferencesDraft = Record<
  PomodoroPreferenceField,
  string
>;

type PomodoroDurationFieldsProps = {
  initialValue?: PomodoroPreferences;
  onValuesChange: (draft: PomodoroPreferencesDraft) => void;
};

type PomodoroDurationFieldDefinition = {
  name: PomodoroPreferenceField;
  label: string;
};

const POMODORO_DURATION_FIELDS: readonly PomodoroDurationFieldDefinition[] = [
  { name: 'focusDurationMinutes', label: 'Concentración' },
  { name: 'shortBreakDurationMinutes', label: 'Descanso corto' },
  { name: 'longBreakDurationMinutes', label: 'Descanso largo' },
];

function parseDraftMinutes(value: string): number | undefined {
  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : Number(trimmedValue);
}

export default function PomodoroDurationFields(
  props: PomodoroDurationFieldsProps,
) {
  const initialValue = props.initialValue ?? DEFAULT_POMODORO_PREFERENCES;
  const [draft, setDraft] = createStore<PomodoroPreferencesDraft>({
    focusDurationMinutes: String(initialValue.focusDurationMinutes),
    shortBreakDurationMinutes: String(initialValue.shortBreakDurationMinutes),
    longBreakDurationMinutes: String(initialValue.longBreakDurationMinutes),
  });
  const [hasEdited, setHasEdited] = createSignal(false);
  const id = createUniqueId();
  const validation = createMemo(() =>
    validatePomodoroPreferences({
      focusDurationMinutes: parseDraftMinutes(draft.focusDurationMinutes),
      shortBreakDurationMinutes: parseDraftMinutes(
        draft.shortBreakDurationMinutes,
      ),
      longBreakDurationMinutes: parseDraftMinutes(
        draft.longBreakDurationMinutes,
      ),
    }),
  );

  onMount(() => props.onValuesChange({ ...draft }));

  const getFieldError = (
    field: PomodoroPreferenceField,
  ): string | undefined => {
    if (!hasEdited()) {
      return undefined;
    }

    const result = validation();

    if (result.ok) {
      return undefined;
    }

    return result.errors.some(
      (error) => error.code === 'invalid-duration' && error.field === field,
    )
      ? 'Escribe un número entero entre 1 y 180 minutos.'
      : undefined;
  };

  const handleInput = (
    field: PomodoroPreferenceField,
    value: string,
  ) => {
    const nextDraft = { ...draft, [field]: value };
    setHasEdited(true);
    setDraft(nextDraft);
    props.onValuesChange(nextDraft);
  };

  const renderField = ({ name, label }: PomodoroDurationFieldDefinition) => {
    const inputId = `pomodoro-duration-${name}-${id}`;
    const unitId = `${inputId}-unit`;
    const errorId = `${inputId}-error`;
    const errorMessage = () => getFieldError(name);

    return (
      <div class="pomodoro-duration-fields__field">
        <label class="pomodoro-duration-fields__label" for={inputId}>
          {label}
        </label>
        <div class="pomodoro-duration-fields__input-group">
          <input
            aria-describedby={`${unitId}${errorMessage() ? ` ${errorId}` : ''}`}
            aria-invalid={errorMessage() !== undefined}
            autocomplete="off"
            class="pomodoro-duration-fields__input"
            id={inputId}
            inputmode="numeric"
            max={MAX_POMODORO_DURATION_MINUTES}
            min={MIN_POMODORO_DURATION_MINUTES}
            name={name}
            required
            step="1"
            type="number"
            value={draft[name]}
            onInput={(event) => handleInput(name, event.currentTarget.value)}
          />
          <span class="pomodoro-duration-fields__unit" id={unitId}>
            min
          </span>
        </div>
        {errorMessage() ? (
          <p
            aria-live="polite"
            class="pomodoro-duration-fields__error"
            id={errorId}
          >
            {errorMessage()}
          </p>
        ) : undefined}
      </div>
    );
  };

  return (
    <fieldset class="pomodoro-duration-fields">
      <legend class="pomodoro-duration-fields__legend">
        Duración de los bloques
      </legend>
      <div class="pomodoro-duration-fields__grid">
        <For each={POMODORO_DURATION_FIELDS}>{renderField}</For>
      </div>
    </fieldset>
  );
}
