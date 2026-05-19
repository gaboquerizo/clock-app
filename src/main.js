import './shared/styles/reset.css';
import './shared/styles/bluelabel.css';
import './shared/styles/typography.css';
import './shared/styles/index.css';

import './shared/components/sidebar/sidebar.component.js';

document.querySelector('#app').innerHTML = `
<app-sidebar><app-sidebar/>
<main>
    <!--<app-content>-->
</main>
`