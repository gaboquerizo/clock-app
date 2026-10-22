import { createContext, useContext, type ParentProps } from 'solid-js';

import type { TimersStateController } from '@/features/timers/state/timers-state';

const TimersStateContext = createContext<TimersStateController>();

export function TimersStateProvider(
  props: ParentProps<{ value: TimersStateController }>,
) {
  return (
    <TimersStateContext.Provider value={props.value}>
      {props.children}
    </TimersStateContext.Provider>
  );
}

export function useTimersState(): TimersStateController {
  const controller = useContext(TimersStateContext);

  if (controller === undefined) {
    throw new Error(
      'Timers state is not available. Did you forget to render TimersStateProvider?',
    );
  }

  return controller;
}
