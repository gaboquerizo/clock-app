import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';

import '@/shared/styles/main.css';
import TimerDialog, {
  type TimerDialogEntryMode,
} from '@/features/timers/components/timer-dialog/timer-dialog';

const root = document.querySelector('#test-root');

if (!(root instanceof HTMLElement)) {
  throw new Error('Timer dialog fixture root is missing.');
}

render(() => {
  const [open, setOpen] = createSignal(false);
  const [mode, setMode] = createSignal<TimerDialogEntryMode>('create');
  const [result, setResult] = createSignal('');
  const timer = { id: 'timer-1', durationMs: 90_000, label: 'Lectura' };

  const openDialog = (nextMode: TimerDialogEntryMode) => {
    setMode(nextMode);
    setOpen(true);
  };

  return (
    <>
      <button onClick={() => openDialog('create')}>Abrir creación</button>
      <button onClick={() => openDialog('edit')}>Abrir edición</button>
      <output aria-live="polite" data-testid="dialog-result">
        {result()}
      </output>
      <TimerDialog
        mode={mode()}
        open={open()}
        timer={timer}
        onClose={() => setOpen(false)}
        onConfirmDelete={(timerId) => {
          setResult(`delete:${timerId}`);
        }}
        onSubmit={(value) => {
          setResult(`submit:${value.durationMs}:${value.label}`)
        }}
      />
    </>
  );
}, root);
