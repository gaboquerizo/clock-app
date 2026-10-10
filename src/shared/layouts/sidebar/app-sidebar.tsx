/*—————————— Library ——————————*/
import { For } from 'solid-js';
import { A } from '@solidjs/router';

/*—————————— Types ——————————*/
import { menuItems, type MenuItem } from '../../../app/menu-items';

/*—————————— Components ——————————*/
import AppIcon from '../../ui/ui-icon/ui-icon';

/*—————————— Styles ——————————*/
import './app-sidebar.css';

const repositoryUrl = 'https://github.com/gaboquerizo/clock-app';

function ClockLogo() {
  return (
    <svg
      aria-hidden="true"
      class="app-logo_gaboquerizo"
      viewBox="0 0 461.00 675.00"
      fill="currentColor"
    >
      <g fill="" stroke="none" transform="translate(0.0,675.0) scale(0.1,-0.1)">
        <path d="M2105 6739 c-134 -11 -214 -25 -376 -64 -163 -40 -248 -72 -437 -165 -230 -112 -403 -233 -581 -405 -199 -192 -310 -339 -440 -581 -345 -644 -357 -1431 -31 -2089 78 -157 177 -313 272 -428 413 -500 976 -794 1621 -848 362 -30 789 47 1122 201 692 319 1185 961 1309 1705 15 92 36 294 36 353 l0 32 -400 0 -400 0 0 -59 c0 -136 -45 -350 -106 -499 -188 -468 -573 -791 -1088 -914 -79 -19 -120 -22 -301 -22 -179 0 -224 3 -309 22 -595 132 -1042 578 -1168 1167 -25 118 -35 381 -19 496 27 184 83 359 163 509 68 126 96 167 195 282 149 172 264 259 488 369 130 64 184 85 290 111 l130 32 866 3 865 4 399 399 400 400 -1200 -1 c-660 -1 -1245 -5 -1300 -10z"></path>
        <path d="M3787 2090 c-23 -212 -139 -496 -280 -685 -177 -237 -447 -435 -716 -524 -198 -66 -256 -75 -486 -75 -179 0 -224 3 -309 22 -279 62 -519 187 -725 377 l-57 54 -282 -282 -281 -282 74 -68 c319 -294 697 -490 1103 -573 364 -74 694 -67 1035 20 233 60 383 121 583 236 642 369 1071 1034 1140 1768 l7 72 -400 0 -400 0 -6 -60z"></path>
      </g>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      class="app-sidebar__github-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"></path>
    </svg>
  );
}

function MenuItemContent(props: { item: MenuItem }) {
  const content = (
    <>
      <AppIcon class="app-sidebar__menu-icon" name={props.item.icon} />
      <span class="app-sidebar__menu-label">{props.item.label}</span>
    </>
  );

  if (props.item.href) {
    return (
      <A
        class="app-sidebar__menu-link"
        activeClass="app-sidebar__menu-link--active"
        end
        href={props.item.href}
      >
        {content}
      </A>
    );
  }

  return (
    <span
      aria-disabled="true"
      class="app-sidebar__menu-placeholder"
    >
      {content}
    </span>
  );
}

export default function AppSidebar() {
  const currentYear = new Date().getFullYear();

  return (
    <div class="app-sidebar">
      <header class="app-sidebar__header">
        <ClockLogo />
        <span class="app-sidebar__brand">Clock app</span>
      </header>

      <nav aria-label="Navegación principal" class="app-sidebar__nav">
        <ul class="app-sidebar__menu">
          <For each={menuItems}>
            {(item) => (
              <li
                class={`app-sidebar__menu-item${item.dividerBefore ? ' app-sidebar__menu-item--divider' : ''}`}
              >
                <MenuItemContent item={item} />
              </li>
            )}
          </For>
        </ul>
      </nav>

      <footer class="app-sidebar__footer">
        <a
          class="app-sidebar__repository"
          href={repositoryUrl}
          rel="noreferrer"
          target="_blank"
        >
          <GitHubIcon />
          <span class="app-sidebar__developer">@gaboquerizo</span>
          <span aria-hidden="true">·</span>
          <time datetime={String(currentYear)}>{currentYear}</time>
        </a>
      </footer>
    </div>
  );
}
