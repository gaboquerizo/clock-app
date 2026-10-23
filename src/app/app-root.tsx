/*—————————— Library ——————————*/
import { createEffect, onCleanup, onMount } from 'solid-js';
import type { RouteSectionProps } from '@solidjs/router';

import { connectAlarmsToGlobalAlerts } from '@/app/global-alert/alarms-alert-bridge';
import { connectTimersToGlobalAlerts } from '@/app/global-alert/timers-alert-bridge';
import { createScheduler } from '@/core/time/scheduler';
import GlobalAlertHost from '@/app/global-alert/global-alert-host';
import { createAlarmsRuntime } from '@/features/alarms/state/alarms-runtime';
import { AlarmsStateProvider } from '@/features/alarms/state/alarms-context';
import { createAlarmsState } from '@/features/alarms/state/alarms-state';
import { TimersStateProvider } from '@/features/timers/state/timers-context';
import { createTimersState } from '@/features/timers/state/timers-state';
import { createTimersRuntime } from '@/features/timers/state/timers-runtime';

/*—————————— Styles ——————————*/
import './app-root.css';

/*—————————— Components ——————————*/
import AppSidebar from '../shared/layouts/sidebar/app-sidebar';

export default function AppRoot(props: RouteSectionProps) {
  const scheduler = createScheduler();
  const alarms = createAlarmsState();
  const alarmsRuntime = createAlarmsRuntime(alarms, { scheduler });
  let cancelTimerProcess: (timerId: string) => void = () => undefined;
  const timers = createTimersState({
    cancelScheduledExecution: (timerId) => cancelTimerProcess(timerId),
  });
  const timersRuntime = createTimersRuntime(timers, { scheduler });
  cancelTimerProcess = timersRuntime.cancel;
  const unsubscribeAlarmAlertBridge =
    connectAlarmsToGlobalAlerts(alarmsRuntime);
  const unsubscribeTimerAlertBridge =
    connectTimersToGlobalAlerts(timersRuntime);

  createEffect(() => {
    alarmsRuntime.sync(alarms.state.alarms);
  });

  createEffect(() => {
    timersRuntime.sync(timers.state.timers);
  });

  onMount(() => {
    scheduler.start();
    void alarmsRuntime.start();
    void timersRuntime.start();
  });

  onCleanup(() => {
    unsubscribeAlarmAlertBridge();
    unsubscribeTimerAlertBridge();
    alarmsRuntime.stop();
    timersRuntime.stop();
    scheduler.stop();
  });

  return (
    <GlobalAlertHost>
      <AlarmsStateProvider value={alarms}>
        <TimersStateProvider value={timers}>
          <div class="app-shell">
            <aside class="app-shell__sidebar">
              <AppSidebar />
            </aside>
            <main class="app-shell__main">{props.children}</main>
          </div>
        </TimersStateProvider>
      </AlarmsStateProvider>
    </GlobalAlertHost>
  );
}
