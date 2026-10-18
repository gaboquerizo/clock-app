/*—————————— Library ——————————*/
import { createEffect, onCleanup, onMount } from 'solid-js';
import type { RouteSectionProps } from '@solidjs/router';

import { createAlarmsRuntime } from '../features/alarms/state/alarms-runtime';
import { AlarmsStateProvider } from '../features/alarms/state/alarms-context';
import { createAlarmsState } from '../features/alarms/state/alarms-state';
import GlobalAlertHost from '@/app/global-alert/global-alert-host';

/*—————————— Styles ——————————*/
import './app-root.css';

/*—————————— Components ——————————*/
import AppSidebar from '../shared/layouts/sidebar/app-sidebar';

export default function AppRoot(props: RouteSectionProps) {
  const alarms = createAlarmsState();
  const alarmsRuntime = createAlarmsRuntime(alarms);

  createEffect(() => {
    alarmsRuntime.sync(alarms.state.alarms);
  });

  onMount(() => {
    void alarmsRuntime.start();
  });

  onCleanup(() => {
    alarmsRuntime.stop();
  });

  return (
    <GlobalAlertHost>
      <AlarmsStateProvider value={alarms}>
        <div class="app-shell">
          <aside class="app-shell__sidebar">
            <AppSidebar />
          </aside>
          <main class="app-shell__main">{props.children}</main>
        </div>
      </AlarmsStateProvider>
    </GlobalAlertHost>
  );
}
