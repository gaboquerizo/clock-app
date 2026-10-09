/* @refresh reload */
import { render } from 'solid-js/web';
import 'solid-devtools';
import './shared/styles/bluelabel.css';

import AppRoot from './app/app-root';

const root = document.querySelector('app-root');

if (!(root instanceof HTMLElement)) {
  throw new Error(
    'App root element not found. Did you forget to add <app-root> to index.html?',
  );
}

render(() => <AppRoot />, root);
