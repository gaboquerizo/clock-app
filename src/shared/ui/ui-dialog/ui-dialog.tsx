/*—————————— Library ——————————*/
import {
  createEffect,
  createUniqueId,
  onCleanup,
  type JSX,
  type ParentProps,
} from 'solid-js';

/*—————————— Styles ——————————*/
import './ui-dialog.css';

export type UiDialogProps = ParentProps<{
  class?: string;
  closeOnBackdrop?: boolean;
  description?: string;
  icon?: JSX.Element;
  onClose: () => void;
  open: boolean;
  title: string;
}>;

export default function UiDialog(props: UiDialogProps) {
  let dialogElement!: HTMLDialogElement;
  let previousActiveElement: HTMLElement | null = null;
  let suppressCloseCallback = false;
  const titleId = `ui-dialog-title-${createUniqueId()}`;
  const descriptionId = `ui-dialog-description-${createUniqueId()}`;

  createEffect(() => {
    if (props.open) {
      if (!dialogElement.open) {
        previousActiveElement =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        dialogElement.showModal();

        queueMicrotask(() => {
          const firstFocusableElement = dialogElement.querySelector<HTMLElement>(
            '[autofocus], button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
          );

          firstFocusableElement?.focus();
        });
      }

      return;
    }

    if (dialogElement.open) {
      suppressCloseCallback = true;
      dialogElement.close();
    }
  });

  onCleanup(() => {
    if (dialogElement.open) {
      suppressCloseCallback = true;
      dialogElement.close();
    }
  });

  const handleClose = () => {
    const shouldNotify = !suppressCloseCallback;

    suppressCloseCallback = false;

    if (shouldNotify) {
      props.onClose();
    }

    queueMicrotask(() => {
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    });
  };

  const handleCancel = (event: Event) => {
    event.preventDefault();
    props.onClose();
  };

  const handleSurfaceClick = (event: MouseEvent) => {
    if (event.target === dialogElement && props.closeOnBackdrop !== false) {
      props.onClose();
    }
  };

  return (
    <dialog
      aria-describedby={props.description ? descriptionId : undefined}
      aria-labelledby={titleId}
      class={`ui-dialog ${props.class ?? ''}`}
      ref={dialogElement}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleSurfaceClick}
    >
      <div class="ui-dialog__surface">
        <header class="ui-dialog__header">
          {props.icon && (
            <div aria-hidden="true" class="ui-dialog__icon">
              {props.icon}
            </div>
          )}
          <div class="ui-dialog__heading">
            <h2 class="ui-dialog__title" id={titleId}>
              {props.title}
            </h2>
            {props.description && (
              <p class="ui-dialog__description" id={descriptionId}>
                {props.description}
              </p>
            )}
          </div>
        </header>
        <div class="ui-dialog__content">{props.children}</div>
      </div>
    </dialog>
  );
}
