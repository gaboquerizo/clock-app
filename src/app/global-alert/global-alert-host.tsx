import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js';

import { globalAlertService } from '@/core/alerts/global-alert-service';
import type {
  GlobalAlertService,
  GlobalAlertSnapshot,
} from '@/core/alerts/global-alert.types';

export type GlobalAlertHostContextValue = {
  snapshot: Accessor<GlobalAlertSnapshot>;
  dismiss(alertId: string): Promise<boolean>;
  selectAction(alertId: string, actionId: string): Promise<boolean>;
};

type GlobalAlertHostProps = ParentProps<{
  service?: GlobalAlertService;
}>;

const GlobalAlertHostContext =
  createContext<GlobalAlertHostContextValue>();

export function useGlobalAlertHost(): GlobalAlertHostContextValue {
  const context = useContext(GlobalAlertHostContext);

  if (context === undefined) {
    throw new Error(
      'Global alert state is unavailable outside GlobalAlertHost.',
    );
  }

  return context;
}

export default function GlobalAlertHost(props: GlobalAlertHostProps) {
  const service = props.service ?? globalAlertService;
  const [snapshot, setSnapshot] = createSignal(service.getSnapshot());
  let unsubscribe: (() => void) | undefined;

  onMount(() => {
    unsubscribe = service.subscribe(setSnapshot);
  });

  onCleanup(() => {
    unsubscribe?.();
  });

  const context: GlobalAlertHostContextValue = {
    snapshot,
    dismiss: (alertId) => service.dismiss(alertId),
    selectAction: (alertId, actionId) =>
      service.selectAction(alertId, actionId),
  };

  return (
    <GlobalAlertHostContext.Provider value={context}>
      {props.children}
    </GlobalAlertHostContext.Provider>
  );
}
