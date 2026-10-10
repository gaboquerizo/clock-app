import type { IconName } from '../shared/ui/ui-icon/ui-icon';

export type MenuItem = {
  label: string;
  icon: IconName;
  href?: '/clock';
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
  },
  {
    label: 'Temporizador',
    icon: 'proicons:hourglass',
  },
  {
    label: 'Cronómetro',
    icon: 'proicons:timer',
  },
  {
    label: 'Pomodoro',
    icon: 'proicons:pie-chart',
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
