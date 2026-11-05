/*—————————— Types ——————————*/
import type { IconName } from '../shared/ui/ui-icon/ui-icon';

export type MenuItem = {
  label: string;
  icon: IconName;
  href?: '/alarms' | '/clock' | '/pomodoro' | '/stopwatch' | '/timers';
  dividerBefore?: boolean;
};

export const menuItems: MenuItem[] = [
  {
    label: 'Reloj',
    icon: 'proicons:clock',
    href: '/clock',
  },
  {
    label: 'Alarma',
    icon: 'proicons:alarm-clock',
    href: '/alarms',
  },
  {
    label: 'Temporizador',
    icon: 'proicons:timer',
    href: '/timers',
  },
  {
    label: 'Cronómetro',
    icon: 'proicons:watch',
    href: '/stopwatch',
  },
  {
    label: 'Pomodoro',
    icon: 'proicons:hourglass',
    href: '/pomodoro',
  },
  {
    label: 'Sesiones',
    icon: 'proicons:history',
  },
  {
    label: 'Preferencias',
    icon: 'proicons:settings',
    dividerBefore: true,
  },
];
