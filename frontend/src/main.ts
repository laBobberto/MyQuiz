import { state } from './state';
import { renderLogin } from './views/AuthView';
import { renderDashboard } from './game';
import { renderHost } from './views/HostView';
import { renderGameView } from './views/GameView';
import { renderProfile } from './views/ProfileView';
import { renderHistory } from './views/HistoryView';

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

export function navigate() {
    appContainer.innerHTML = '';

    if (!state.token) {
        renderLogin(appContainer);
        return;
    }

    switch (state.view) {
        case 'dashboard':
            renderDashboard(appContainer);
            break;
        case 'host':
            renderHost(appContainer, state.roomCode);
            break;
        case 'player':
            renderGameView(appContainer);
            break;
        case 'profile':
            renderProfile(appContainer);
            break;
        case 'history':
            renderHistory(appContainer);
            break;
        default:
            renderDashboard(appContainer);
    }
}

export { state };

import './style.css';

navigate();

