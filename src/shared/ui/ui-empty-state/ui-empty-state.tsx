/*—————————— Library ——————————*/
import { createUniqueId, type ParentProps } from 'solid-js';

/*—————————— Components ——————————*/
import AppIcon, { type IconName } from '../ui-icon/ui-icon';

/*—————————— Styles ——————————*/
import './ui-empty-state.css';

type UiEmptyStateProps = ParentProps<{
  description: string;
  icon: IconName;
  title: string;
}>;

export default function UiEmptyState(props: UiEmptyStateProps) {
  const titleId = `ui-empty-state-title-${createUniqueId()}`;

  return (
    <section aria-labelledby={titleId} class="ui-empty-state">
      <AppIcon class="ui-empty-state__icon" name={props.icon} />
      <h2 class="ui-empty-state__title" id={titleId}>
        {props.title}
      </h2>
      <p class="ui-empty-state__description">{props.description}</p>
      <div class="ui-empty-state__actions">{props.children}</div>
    </section>
  );
}
