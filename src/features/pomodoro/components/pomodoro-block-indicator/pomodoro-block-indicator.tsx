import './pomodoro-block-indicator.css';

import type { PomodoroBlockType } from '@/features/pomodoro/domain/pomodoro.types';
import UiIcon, { type IconName } from '@/shared/ui/ui-icon/ui-icon';

type PomodoroBlockIndicatorProps = {
  blockType: PomodoroBlockType;
};

type BlockPresentation = {
  icon: IconName;
  label: string;
};

const BLOCK_PRESENTATION: Record<PomodoroBlockType, BlockPresentation> = {
  focus: {
    icon: 'proicons:timer',
    label: 'Concentración',
  },
  'short-break': {
    icon: 'proicons:clock',
    label: 'Descanso corto',
  },
  'long-break': {
    icon: 'proicons:hourglass',
    label: 'Descanso largo',
  },
};

export default function PomodoroBlockIndicator(
  props: PomodoroBlockIndicatorProps,
) {
  const presentation = () => BLOCK_PRESENTATION[props.blockType];

  return (
    <p
      aria-atomic="true"
      class="pomodoro-block-indicator"
      data-block-type={props.blockType}
      role="status"
    >
      <UiIcon
        class="pomodoro-block-indicator__icon"
        name={presentation().icon}
      />
      <span>{presentation().label}</span>
    </p>
  );
}
