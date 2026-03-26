import ReactDOM from 'react-dom/client';
import { AppBootstrap } from './app/bootstrap';
import { HudApp } from './app/hud/HudApp';
import { applyCachedThemeToDocument } from './features/themes/theme-store';
import './styles/globals.css';

document.body.dataset.surface = 'overlay';
document.body.dataset.overlayWindow = 'hud';
applyCachedThemeToDocument();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppBootstrap>
    <HudApp />
  </AppBootstrap>,
);
