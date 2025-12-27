import { api } from '../api';
import { navigate } from '../main';
import { state } from '../state';

export async function renderProfile(container: HTMLElement) {
    let user: any = null;
    try {
        user = await api.get('/users/me');
    } catch (e) {
        alert('Ошибка загрузки профиля');
        return;
    }

    const avatars = [
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Cal",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
        "https://api.dicebear.com/7.x/bottts/svg?seed=1",
        "https://api.dicebear.com/7.x/bottts/svg?seed=2",
        "https://api.dicebear.com/7.x/bottts/svg?seed=3"
    ];

    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
            <div class="header" style="margin-bottom: 2rem;">
                <button id="back-btn" class="btn-secondary"><i class="fas fa-arrow-left"></i> Назад</button>
                <div class="logo">Профиль</div>
                <div style="width: 80px;"></div>
            </div>

            <div class="card mb-4" style="text-align: center;">
                <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.username}" 
                     alt="Avatar" 
                     style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid var(--primary); margin-bottom: 1rem; object-fit: cover;">
                
                <h2 style="margin-bottom: 0.5rem;">${user.username}</h2>
                <p class="text-secondary" style="margin-bottom: 1.5rem;">${user.bio || 'Нет информации'}</p>

                <button id="edit-profile-btn" class="btn-primary">
                    <i class="fas fa-edit"></i> Редактировать профиль
                </button>
            </div>
            
            <div class="card">
                <h3><i class="fas fa-shield-alt"></i> Безопасность</h3>
                <p class="text-secondary mb-3">Смена пароля доступна через выход и функцию "Забыли пароль".</p>
                <button id="logout-btn-prof" class="btn-danger">
                    <i class="fas fa-sign-out-alt"></i> Выйти из аккаунта
                </button>
            </div>
        </div>
    `;

    document.getElementById('back-btn')?.addEventListener('click', () => {
        state.view = 'dashboard';
        navigate();
    });

    document.getElementById('logout-btn-prof')?.addEventListener('click', () => {
        localStorage.clear();
        location.reload();
    });

    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
        showEditProfileDialog(user, avatars, () => renderProfile(container));
    });
}

function showEditProfileDialog(user: any, avatars: string[], onSave: () => void) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;
        overflow-y: auto;
    `;

    let selectedAvatar = user.avatar_url;

    overlay.innerHTML = `
        <div class="card" style="max-width: 500px; width: 90%; margin: 2rem auto;">
            <h2 class="mb-3">Редактирование</h2>
            
            <div class="form-group">
                <label>Выберите аватар</label>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 1rem;">
                    ${avatars.map(url => `
                        <img src="${url}" class="avatar-option" data-url="${url}" 
                             style="width: 100%; cursor: pointer; border-radius: 8px; border: 2px solid ${url === selectedAvatar ? 'var(--primary)' : 'transparent'};">
                    `).join('')}
                </div>
            </div>

            <div class="form-group">
                <label>О себе</label>
                <textarea id="edit-bio" style="width: 100%; min-height: 80px;">${user.bio || ''}</textarea>
            </div>

            <button id="save-profile" class="btn-primary" style="width: 100%;">Сохранить</button>
            <button id="cancel-profile" class="btn-secondary" style="width: 100%; margin-top: 0.5rem;">Отмена</button>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('.avatar-option').forEach(img => {
        img.addEventListener('click', (e) => {
            overlay.querySelectorAll('.avatar-option').forEach(i => (i as HTMLElement).style.borderColor = 'transparent');
            (e.target as HTMLElement).style.borderColor = 'var(--primary)';
            selectedAvatar = (e.target as HTMLElement).getAttribute('data-url');
        });
    });

    overlay.querySelector('#save-profile')?.addEventListener('click', async () => {
        const bio = (overlay.querySelector('#edit-bio') as HTMLTextAreaElement).value;
        try {
            await api.put('/users/me', { avatar_url: selectedAvatar, bio });
            document.body.removeChild(overlay);
            onSave();
        } catch (e) {
            alert('Ошибка сохранения');
        }
    });

    overlay.querySelector('#cancel-profile')?.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
}
