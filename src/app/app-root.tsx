/*—————————— Styles ——————————*/
import './app-root.css';
/*—————————— Components ——————————*/
import AppSidebar from '../shared/layouts/sidebar/app-sidebar';

export default function AppRoot() {
  return (
    <div class="app-shell">
      <aside class="app-shell__sidebar">
        <AppSidebar />
      </aside>
      <main class="app-shell__main" />
    </div>
  );
}
