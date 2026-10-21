/*—————————— Types ——————————*/
import type { IconName } from '../shared/ui/ui-icon/ui-icon';

export type MenuItem = {
  label: string;
  icon: IconName;
  href?: '/alarms' | '/clock';
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
  },
  {
    label: 'Cronómetro',
    icon: 'proicons:watch',
  },
  {
    label: 'Pomodoro',
    icon: 'proicons:hourglass',
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
