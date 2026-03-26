import ReactDOM from 'react-dom/client';
import { AppBootstrap } from './app/bootstrap';
import { QuickAddApp } from './app/quick-add/QuickAddApp';
import { applyCachedThemeToDocument } from './features/themes/theme-store';
import './styles/globals.css';

document.body.dataset.surface = 'overlay';
document.body.dataset.overlayWindow = 'quick-add';
applyCachedThemeToDocument();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppBootstrap>
    <QuickAddApp />
  </AppBootstrap>,
);
