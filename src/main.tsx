import ReactDOM from 'react-dom/client';
import { AppBootstrap } from './app/bootstrap';
import { MainApp } from './app/main/MainApp';
import './styles/globals.css';

document.body.dataset.surface = 'main';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppBootstrap>
    <MainApp />
  </AppBootstrap>,
);
