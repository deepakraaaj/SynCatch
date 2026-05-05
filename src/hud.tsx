import ReactDOM from 'react-dom/client';
import { initSupabaseAuth, watchAuthChanges } from './lib/auth';
import { HudAppWithAuth } from './app/hud/HudAppWithAuth';
import { applyCachedThemeToDocument } from './features/themes/theme-store';
import './styles/globals.css';

document.body.dataset.surface = 'overlay';
document.body.dataset.overlayWindow = 'hud';
applyCachedThemeToDocument();

async function bootstrap() {
  try {
    await initSupabaseAuth();
    watchAuthChanges();
  } catch (error) {
    console.error('Failed to initialize auth:', error);
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <HudAppWithAuth />,
  );
}

void bootstrap();
