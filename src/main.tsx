import ReactDOM from 'react-dom/client';
import { AppBootstrap } from './app/bootstrap';
import { MainApp } from './app/main/MainApp';
import { applyCachedThemeToDocument } from './features/themes/theme-store';
import './styles/globals.css';

document.body.dataset.surface = 'main';
applyCachedThemeToDocument();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppBootstrap>
    <MainApp />
  </AppBootstrap>,
);
