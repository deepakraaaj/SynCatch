import ReactDOM from 'react-dom/client';
import { AppBootstrap } from './app/bootstrap';
import { QuickAddApp } from './app/quick-add/QuickAddApp';
import './styles/globals.css';

document.body.dataset.surface = 'overlay';
document.body.dataset.overlayWindow = 'quick-add';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppBootstrap>
    <QuickAddApp />
  </AppBootstrap>,
);
