import { createEffect, createSignal, createUniqueId, Show } from 'solid-js';

import type { Timer } from '@/features/timers/domain/timer.types';
import TimerDurationInput from '@/features/timers/components/timer-duration-input/timer-duration-input';
import UiDialog from '@/shared/ui/ui-dialog/ui-dialog';
import AppIcon from '@/shared/ui/ui-icon/ui-icon';

import './timer-dialog.css';

export type TimerDialogMode = 'create' | 'edit' | 'confirm-delete';

export type TimerDialogValue = {
  durationMs: number;
  label: string;
};

export type TimerDialogTimer = Pick<Timer, 'id' | 'durationMs' | 'label'>;

export type TimerDialogProps = {
  mode: TimerDialogMode;
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  error?: string;
  timer?: TimerDialogTimer;
  onSubmit?: (value: TimerDialogValue) => void | Promise<void>;
  onConfirmDelete?: (timerId: string) => void | Promise<void>;
};

function getAccessibleName(mode: TimerDialogMode): string {
  if (mode === 'confirm-delete') return 'Eliminar temporizador';
  return mode === 'edit' ? 'Editar temporizador' : 'Añadir temporizador';
}

export default function TimerDialog(props: TimerDialogProps) {
  const [activeMode, setActiveMode] = createSignal<TimerDialogMode>(props.mode);
  const [durationMs, setDurationMs] = createSignal<number>();
  const [label, setLabel] = createSignal('');
  const [formInstance, setFormInstance] = createSignal(0);
  const [formError, setFormError] = createSignal<string>();
  const [contentHeight, setContentHeight] = createSignal<number>();
  const id = createUniqueId();
  let previousExternalMode = props.mode;
  let previousFormKey = '';
  let formPanel!: HTMLDivElement;
  let formContent!: HTMLFormElement;
  let confirmationContent!: HTMLElement;
  let confirmationCancelButton!: HTMLButtonElement;

  const isConfirmation = () => activeMode() === 'confirm-delete';

  const updateContentHeight = () => {
    const activeContent = isConfirmation() ? confirmationContent : formContent;
    if (activeContent) setContentHeight(activeContent.scrollHeight);
  };

  const focusContent = (mode: TimerDialogMode) => {
    queueMicrotask(() => {
      updateContentHeight();
      const focusTarget =
        mode === 'confirm-delete'
          ? confirmationCancelButton
          : formPanel?.querySelector<HTMLElement>('input, button');
      focusTarget?.focus();
    });
  };

  const switchToMode = (mode: TimerDialogMode) => {
    if (mode === activeMode()) return;
    if (mode === 'confirm-delete' && props.timer === undefined) return;
    setActiveMode(mode);
    setFormError(undefined);
    focusContent(mode);
  };

  createEffect(() => {
    const isOpen = props.open;
    const externalMode = props.mode;
    const timer = props.timer;
    const resolvedMode =
      externalMode === 'confirm-delete' && timer === undefined
        ? 'create'
        : externalMode;

    if (!isOpen) {
      setActiveMode(resolvedMode);
      setDurationMs(undefined);
      setLabel('');
      setFormError(undefined);
      previousExternalMode = externalMode;
      previousFormKey = '';
      setContentHeight(undefined);
      return;
    }

    if (externalMode !== previousExternalMode) {
      previousExternalMode = externalMode;
      setActiveMode(resolvedMode);
      focusContent(resolvedMode);
    }

    const formMode = resolvedMode === 'create' ? 'create' : 'edit';
    const timerId = formMode === 'edit' ? timer?.id ?? 'missing' : 'new';
    const initialDuration = formMode === 'edit' ? timer?.durationMs : undefined;
    const initialLabel = formMode === 'edit' ? timer?.label ?? '' : '';
    const formKey = `${formMode}:${timerId}:${initialDuration ?? ''}:${initialLabel}`;

    if (formKey !== previousFormKey) {
      previousFormKey = formKey;
      setDurationMs(initialDuration);
      setLabel(initialLabel);
      setFormError(undefined);
      setFormInstance((instance) => instance + 1);
    }
  });

  createEffect(() => {
    const isOpen = props.open;
    activeMode();
    if (isOpen) queueMicrotask(updateContentHeight);
  });

  const submitForm = (event: SubmitEvent) => {
    event.preventDefault();
    if (isConfirmation() || props.busy === true) return;

    const currentDuration = durationMs();
    if (currentDuration === undefined) {
      setFormError('Introduce una duración mayor que 00:00:00.');
      return;
    }

    setFormError(undefined);
    void props.onSubmit?.({
      durationMs: currentDuration,
      label: label().trim(),
    });
  };

  const confirmDelete = () => {
    if (props.timer) void props.onConfirmDelete?.(props.timer.id);
  };

  return (
    <UiDialog
      class="timer-dialog-shell"
      open={props.open}
      showHeader={false}
      title={getAccessibleName(activeMode())}
      onClose={props.onClose}
    >
      <div aria-busy={props.busy === true} class="timer-dialog">
        <div
          aria-hidden="true"
          class="timer-dialog__mode-icon t-icon-swap"
          data-state={isConfirmation() ? 'b' : 'a'}
        >
          <span class="timer-dialog__mode-icon-item t-icon" data-icon="a">
            <AppIcon class="timer-dialog__mode-icon-svg" name="proicons:timer" />
          </span>
          <span class="timer-dialog__mode-icon-item t-icon" data-icon="b">
            <AppIcon class="timer-dialog__mode-icon-svg" name="proicons:delete" />
          </span>
        </div>

        <Show when={!isConfirmation() && formError()}>
          {(error) => (
            <p aria-live="assertive" class="timer-dialog__error" role="alert">
              {error()}
            </p>
          )}
        </Show>
        <Show when={!isConfirmation() && props.error}>
          {(error) => (
            <p aria-live="assertive" class="timer-dialog__error" role="alert">
              {error()}
            </p>
          )}
        </Show>

        <div
          class="timer-dialog__content-switcher"
          style={{
            height: contentHeight() === undefined ? 'auto' : `${contentHeight()}px`,
          }}
        >
          <div
            aria-hidden={isConfirmation()}
            class="timer-dialog__content-panel t-panel-slide"
            data-open={String(!isConfirmation())}
            inert={isConfirmation()}
            ref={formPanel}
          >
            <form class="timer-dialog__form" onSubmit={submitForm} ref={formContent}>
              <Show keyed when={formInstance()}>
                <TimerDurationInput
                  initialValueMs={durationMs()}
                  onValueChange={(value) => {
                    setDurationMs(value);
                    if (value !== undefined) setFormError(undefined);
                  }}
                />
              </Show>

              <label class="timer-dialog__label-field">
                <AppIcon class="timer-dialog__label-icon" name="proicons:edit" />
                <input
                  aria-label="Etiqueta del temporizador (opcional)"
                  class="timer-dialog__label-input"
                  maxlength="100"
                  name="label"
                  placeholder="Nuevo temporizador"
                  type="text"
                  value={label()}
                  onInput={(event) => setLabel(event.currentTarget.value)}
                />
              </label>

              <div class="timer-dialog__actions">
                <Show when={activeMode() === 'edit' && props.timer !== undefined}>
                  <button
                    class="timer-dialog__button timer-dialog__button--danger"
                    disabled={props.busy === true}
                    type="button"
                    onClick={() => switchToMode('confirm-delete')}
                  >
                    Eliminar
                  </button>
                </Show>
                <Show when={activeMode() === 'create'}>
                  <button
                    class="timer-dialog__button timer-dialog__button--secondary"
                    disabled={props.busy === true}
                    type="button"
                    onClick={props.onClose}
                  >
                    Cancelar
                  </button>
                </Show>
                <button
                  class="timer-dialog__button timer-dialog__button--primary"
                  disabled={props.busy === true}
                  type="submit"
                >
                  {activeMode() === 'edit' ? 'Guardar' : 'Añadir'}
                </button>
              </div>
            </form>
          </div>

          <div
            aria-hidden={!isConfirmation()}
            class="timer-dialog__content-panel timer-dialog__confirmation-panel t-panel-slide"
            data-open={String(isConfirmation())}
            inert={!isConfirmation()}
          >
            <section
              aria-labelledby={`timer-dialog-delete-title-${id}`}
              class="timer-dialog__confirmation"
              ref={confirmationContent}
            >
              <h3
                class="timer-dialog__confirmation-title"
                id={`timer-dialog-delete-title-${id}`}
              >
                ¿Eliminar este temporizador?
              </h3>
              <p class="timer-dialog__confirmation-description">
                El temporizador «{props.timer?.label || 'Temporizador'}» se eliminará
                cuando se confirme.
              </p>
              <div class="timer-dialog__actions">
                <button
                  class="timer-dialog__button timer-dialog__button--secondary"
                  ref={confirmationCancelButton}
                  type="button"
                  onClick={() => switchToMode('edit')}
                >
                  Cancelar
                </button>
                <button
                  class="timer-dialog__button timer-dialog__button--danger"
                  disabled={props.timer === undefined}
                  type="button"
                  onClick={confirmDelete}
                >
                  Eliminar
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </UiDialog>
  );
}
