/*——— Library ———*/
import { createEffect, createSignal, Show } from 'solid-js';

/*——— Types ———*/
import type { Alarm } from '../../domain/alarm.types';

/*——— Components ———*/
import AlarmTimeInput from '../alarm-time-input/alarm-time-input';
import UiDialog from '../../../../shared/ui/ui-dialog/ui-dialog';
import AppIcon from '../../../../shared/ui/ui-icon/ui-icon';

/*——— Styles ———*/
import './alarm-dialog.css';

export type AlarmDialogMode = 'create' | 'edit' | 'confirm-delete';

export type AlarmDialogValue = {
  label: string;
  time: string;
};

export type AlarmDialogError = {
  message: string;
};

export type AlarmDialogProps = {
  alarm?: Pick<Alarm, 'id' | 'label' | 'time'>;
  busy?: boolean;
  error?: AlarmDialogError;
  mode: AlarmDialogMode;
  onClearError?: () => void;
  onClose: () => void;
  onConfirmDelete?: (alarmId: string) => void | Promise<void>;
  onSubmit?: (value: AlarmDialogValue) => void | Promise<void>;
  open: boolean;
};

function getAccessibleName(mode: AlarmDialogMode): string {
  if (mode === 'confirm-delete') {
    return 'Eliminar alarma';
  }

  return mode === 'edit' ? 'Editar alarma' : 'Añadir alarma';
}

export default function AlarmDialog(props: AlarmDialogProps) {
  const [activeMode, setActiveMode] = createSignal<AlarmDialogMode>(props.mode);
  const [time, setTime] = createSignal('00:00');
  const [label, setLabel] = createSignal('');
  const [formInstance, setFormInstance] = createSignal(0);
  const [contentHeight, setContentHeight] = createSignal<number>();
  let previousExternalMode = props.mode;
  let previousFormKey = '';
  let formPanel!: HTMLDivElement;
  let confirmationPanel!: HTMLDivElement;
  let confirmationCancelButton!: HTMLButtonElement;

  const isConfirmation = () => activeMode() === 'confirm-delete';

  const updateContentHeight = () => {
    const activePanel = isConfirmation() ? confirmationPanel : formPanel;

    if (activePanel !== undefined) {
      setContentHeight(activePanel.scrollHeight);
    }
  };

  const focusContent = (mode: AlarmDialogMode) => {
    queueMicrotask(() => {
      updateContentHeight();

      const focusTarget =
        mode === 'confirm-delete'
          ? confirmationCancelButton
          : formPanel?.querySelector<HTMLElement>('input, button');

      focusTarget?.focus();
    });
  };

  const switchToMode = (mode: AlarmDialogMode) => {
    if (mode === activeMode()) {
      return;
    }

    if (mode === 'confirm-delete' && props.alarm === undefined) {
      return;
    }

    if (mode === 'edit') {
      props.onClearError?.();
    }

    setActiveMode(mode);
    focusContent(mode);
  };

  createEffect(() => {
    const isOpen = props.open;
    const externalMode = props.mode;

    if (!isOpen) {
      setActiveMode(externalMode);
      previousExternalMode = externalMode;
      previousFormKey = '';
      setContentHeight(undefined);
      return;
    }

    if (externalMode !== previousExternalMode) {
      previousExternalMode = externalMode;
      setActiveMode(externalMode);
      focusContent(externalMode);
    }

    const formMode = externalMode === 'edit' ? 'edit' : 'create';
    const alarmId = props.alarm?.id ?? 'new';
    const initialTime = formMode === 'edit' ? props.alarm?.time ?? '00:00' : '00:00';
    const initialLabel = formMode === 'edit' ? props.alarm?.label ?? '' : '';
    const formKey = `${formMode}:${alarmId}:${initialTime}:${initialLabel}`;

    if (formKey !== previousFormKey) {
      previousFormKey = formKey;
      setTime(initialTime);
      setLabel(initialLabel);
      setFormInstance((instance) => instance + 1);
    }
  });

  createEffect(() => {
    const isOpen = props.open;
    activeMode();

    if (isOpen) {
      queueMicrotask(updateContentHeight);
    }
  });

  const submitForm = (event: SubmitEvent) => {
    event.preventDefault();

    if (activeMode() === 'confirm-delete') {
      return;
    }

    void props.onSubmit?.({
      label: label().trim(),
      time: time(),
    });
  };

  const confirmDelete = () => {
    const alarmId = props.alarm?.id;

    if (alarmId !== undefined) {
      void props.onConfirmDelete?.(alarmId);
    }
  };

  return (
    <UiDialog
      open={props.open}
      showHeader={false}
      title={getAccessibleName(activeMode())}
      onClose={props.onClose}
    >
      <div aria-busy={props.busy === true} class="alarm-dialog">
        <div
          class="alarm-dialog__mode-icon t-icon-swap"
          data-mode={activeMode()}
          data-state={isConfirmation() ? 'b' : 'a'}
        >
          <span class="alarm-dialog__mode-icon-item t-icon" data-icon="a">
            <AppIcon class="alarm-dialog__mode-icon-svg" name="proicons:alarm-clock" />
          </span>
          <span class="alarm-dialog__mode-icon-item t-icon" data-icon="b">
            <AppIcon class="alarm-dialog__mode-icon-svg" name="proicons:delete" />
          </span>
        </div>

        <Show when={props.error !== undefined}>
          <p aria-live="assertive" class="alarm-dialog__error" role="alert">
            {props.error?.message}
          </p>
        </Show>

        <div
          class="alarm-dialog__content-switcher"
          style={{
            height:
              contentHeight() === undefined ? 'auto' : `${contentHeight()}px`,
          }}
        >
          <div
            aria-hidden={isConfirmation()}
            class="alarm-dialog__content-panel t-panel-slide"
            data-open={String(!isConfirmation())}
            inert={isConfirmation()}
            ref={formPanel}
          >
            <form class="alarm-dialog__form" onSubmit={submitForm}>
              <Show keyed when={formInstance()}>
                <AlarmTimeInput initialValue={time()} onChange={setTime} />
              </Show>

              <label class="alarm-dialog__label-field">
                <AppIcon class="alarm-dialog__label-icon" name="proicons:edit" />
                <span class="alarm-dialog__visually-hidden">Etiqueta</span>
                <input
                  aria-label="Etiqueta de la alarma"
                  class="alarm-dialog__label-input"
                  maxlength="100"
                  name="label"
                  placeholder="Nueva alarma"
                  type="text"
                  value={label()}
                  onInput={(event) => setLabel(event.currentTarget.value)}
                />
              </label>

              <div class="alarm-dialog__actions">
                <Show when={activeMode() === 'edit' && props.alarm !== undefined}>
                  <button
                    class="alarm-dialog__button alarm-dialog__button--danger"
                    disabled={props.busy === true}
                    type="button"
                    onClick={() => switchToMode('confirm-delete')}
                  >
                    Eliminar
                  </button>
                </Show>
                <button
                  class="alarm-dialog__button alarm-dialog__button--secondary"
                  disabled={props.busy === true}
                  type="button"
                  onClick={props.onClose}
                >
                  Cancelar
                </button>
                <button
                  class="alarm-dialog__button alarm-dialog__button--primary"
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
            class="alarm-dialog__content-panel alarm-dialog__confirmation-panel t-panel-slide"
            data-open={String(isConfirmation())}
            inert={!isConfirmation()}
            ref={confirmationPanel}
          >
            <section aria-labelledby="alarm-dialog-delete-title" class="alarm-dialog__confirmation">
              <h3 class="alarm-dialog__confirmation-title" id="alarm-dialog-delete-title">
                ¿Eliminar esta alarma?
              </h3>
              <p class="alarm-dialog__confirmation-description">
                La alarma «{props.alarm?.label || 'Alarma'}» se eliminará cuando se confirme.
              </p>
              <div class="alarm-dialog__actions">
                <button
                  class="alarm-dialog__button alarm-dialog__button--secondary"
                  disabled={props.busy === true}
                  ref={confirmationCancelButton}
                  type="button"
                  onClick={() => switchToMode('edit')}
                >
                  Cancelar
                </button>
                <button
                  class="alarm-dialog__button alarm-dialog__button--danger"
                  disabled={props.alarm === undefined || props.busy === true}
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
