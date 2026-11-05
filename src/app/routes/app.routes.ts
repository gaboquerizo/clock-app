/*—————————— Library ——————————*/
import { Navigate, Router, type RouteDefinition } from '@solidjs/router';
import { createComponent } from 'solid-js';

/*—————————— Functions ——————————*/
import AlarmsView from '../../features/alarms/views/alarms-view';
import ClockView from '../../features/clock/views/clock-view';
import PomodoroView from '@/features/pomodoro/views/pomodoro-view';
import StopwatchView from '@/features/stopwatch/views/stopwatch-view';
import TimersView from '@/features/timers/views/timers-view';
import AppRoot from '../app-root';

export const appRoutes: RouteDefinition[] = [
  {
    path: '/',
    component: () => createComponent(Navigate, { href: '/clock' }),
  },
  {
    path: '/clock',
    component: ClockView,
  },
  {
    path: '/alarms',
    component: AlarmsView,
  },
  {
    path: '/timers',
    component: TimersView,
  },
  {
    path: '/stopwatch',
    component: StopwatchView,
  },
  {
    path: '/pomodoro',
    component: PomodoroView,
  },
];

export default function AppRoutes() {
  return createComponent(Router, {
    root: AppRoot,
    children: appRoutes,
  });
}
