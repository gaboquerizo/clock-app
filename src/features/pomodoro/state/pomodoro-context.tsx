import { createContext, useContext, type ParentProps } from 'solid-js';

import type { PomodoroStateController } from './pomodoro-state';

const PomodoroStateContext = createContext<PomodoroStateController>();

export function PomodoroStateProvider(
  props: ParentProps<{ value: PomodoroStateController }>,
) {
  return (
    <PomodoroStateContext.Provider value={props.value}>
      {props.children}
    </PomodoroStateContext.Provider>
  );
}

export function usePomodoroState(): PomodoroStateController {
  const controller = useContext(PomodoroStateContext);

  if (controller === undefined) {
    throw new Error(
      'Pomodoro state is not available. Did you forget to render PomodoroStateProvider?',
    );
  }

  return controller;
}
