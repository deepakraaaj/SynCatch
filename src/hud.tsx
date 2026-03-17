import ReactDOM from 'react-dom/client';
import { AppBootstrap } from './app/bootstrap';
import { HudApp } from './app/hud/HudApp';
import './styles/globals.css';

document.body.dataset.surface = 'overlay';
document.body.dataset.overlayWindow = 'hud';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppBootstrap>
    <HudApp />
  </AppBootstrap>,
);
