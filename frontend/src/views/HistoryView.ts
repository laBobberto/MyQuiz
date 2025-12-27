import { api } from '../api';
import { navigate } from '../main';
import { state } from '../state';

export async function renderHistory(container: HTMLElement) {
    let history: any[] = [];
    try {
        history = await api.get('/users/me/history');
    } catch (e) {
        console.error(e);
    }

    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
            <div class="header" style="margin-bottom: 2rem;">
                <button id="back-btn" class="btn-secondary"><i class="fas fa-arrow-left"></i> Назад</button>
                <div class="logo">История игр</div>
                <div style="width: 80px;"></div>
            </div>

            <div class="grid" style="gap: 1rem;">
                ${history.length === 0 ? '<p class="text-center text-secondary">История пуста</p>' : history.map(entry => `
                    <div class="glass-card" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                                ${new Date(entry.date).toLocaleDateString()} ${new Date(entry.date).toLocaleTimeString()}
                            </div>
                            <h3 style="margin-bottom: 0.5rem;">${entry.quiz_title}</h3>
                            <div class="status-badge ${entry.role === 'host' ? 'status-active' : 'status-waiting'}" style="display: inline-block;">
                                ${entry.role === 'host' ? 'Ведущий' : 'Игрок'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            ${entry.role === 'player' ? `
                                <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">
                                    ${entry.score} очков
                                </div>
                                <div style="color: var(--text-secondary);">
                                    Место: ${entry.rank}
                                </div>
                            ` : `
                                <div style="color: var(--text-secondary);">
                                    Код комнаты: <span style="font-family: monospace;">${entry.room_code}</span>
                                </div>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('back-btn')?.addEventListener('click', () => {
        state.view = 'dashboard';
        navigate();
    });
}
