/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Library â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
import { createContext, useContext, type ParentProps } from 'solid-js';

/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Types â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
import type { AlarmsStateController } from './alarms-state';

const AlarmsStateContext = createContext<AlarmsStateController>();

export function AlarmsStateProvider(
  props: ParentProps<{ value: AlarmsStateController }>,
) {
  return (
    <AlarmsStateContext.Provider value={props.value}>
      {props.children}
    </AlarmsStateContext.Provider>
  );
}

export function useAlarmsState(): AlarmsStateController {
  const controller = useContext(AlarmsStateContext);

  if (controller === undefined) {
    throw new Error(
      'Alarms state is not available. Did you forget to render AlarmsStateProvider?',
    );
  }

  return controller;
}
