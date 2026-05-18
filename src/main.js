import './style.css'
import javascriptLogo from './assets/javascript.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'

document.querySelector('#app').innerHTML = `
<section id="center">
  <div class="hero">
    <img src="${heroImg}" class="base" width="170" height="179" alt="Hero">
    <img src="${javascriptLogo}" class="framework" alt="JavaScript logo">
    <img src="${viteLogo}" class="vite" alt="Vite logo">
  </div>
  <button id="counter" type="button" class="counter">Click me</button>
</section>
`

