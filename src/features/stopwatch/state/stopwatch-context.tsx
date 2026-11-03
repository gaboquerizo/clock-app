import { createContext, useContext, type ParentProps } from 'solid-js';

import type { StopwatchStateController } from '@/features/stopwatch/state/stopwatch-state';

const StopwatchStateContext = createContext<StopwatchStateController>();

export function StopwatchStateProvider(
  props: ParentProps<{ value: StopwatchStateController }>,
) {
  return (
    <StopwatchStateContext.Provider value={props.value}>
      {props.children}
    </StopwatchStateContext.Provider>
  );
}

export function useStopwatchState(): StopwatchStateController {
  const controller = useContext(StopwatchStateContext);

  if (controller === undefined) {
    throw new Error(
      'Stopwatch state is not available. Did you forget to render StopwatchStateProvider?',
    );
  }

  return controller;
}
