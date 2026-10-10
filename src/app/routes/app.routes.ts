/*—————————— Library ——————————*/
import { Navigate, Router, type RouteDefinition } from '@solidjs/router';
import { createComponent } from 'solid-js';

/*—————————— Functions ——————————*/
import ClockView from '../../features/clock/views/clock-view';
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
];

export default function AppRoutes() {
  return createComponent(Router, {
    root: AppRoot,
    children: appRoutes,
  });
}
