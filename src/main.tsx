/*—————————— Library ——————————*/
import { render } from 'solid-js/web';
import 'solid-devtools';

/*—————————— Styles ——————————*/
import './shared/styles/main.css';

/*—————————— Components ——————————*/
import AppRoutes from './app/routes/app.routes';

const root = document.querySelector('app-root');

if (!(root instanceof HTMLElement)) {
  throw new Error(
    'App root element not found. Did you forget to add <app-root> to index.html?',
  );
}

render(() => <AppRoutes />, root);
