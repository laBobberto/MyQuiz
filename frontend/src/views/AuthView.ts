import { api } from '../api';
import { state, setToken } from '../state';
import { navigate } from '../main';

export function renderLogin(container: HTMLElement) {
    container.innerHTML = `
        <div class="center-flex">
            <div class="card" style="max-width: 400px; width: 100%;">
                <div class="text-center mb-4">
                    <h1><span style="color: var(--primary);">MY</span><span style="color: var(--success);">QUIZ</span></h1>
                    <p class="text-secondary">Онлайн викторина для друзей</p>
                </div>

                <div class="form-group">
                    <label for="username">Логин</label>
                    <input id="username" type="text" placeholder="Введите ваш логин" autofocus>
                </div>

                <div class="form-group">
                    <label for="password">Пароль</label>
                    <input id="password" type="password" placeholder="Введите пароль">
                </div>

                <div id="error-message" class="alert alert-danger" style="display: none;"></div>

                <button id="login-btn" class="btn-primary" style="width: 100%; margin-bottom: 1rem;">
                    <i class="fas fa-sign-in-alt"></i> Войти
                </button>

                <div class="text-center">
                    <p class="text-sm" style="margin-bottom: 0.5rem;">
                        <a href="#" id="to-reg" style="color: var(--primary); text-decoration: none;">
                            Создать аккаунт
                        </a>
                    </p>
                    <p class="text-sm">
                        <a href="#" id="reset-pwd" style="color: var(--text-secondary); text-decoration: none;">
                            Забыли пароль?
                        </a>
                    </p>
                </div>
            </div>
        </div>
    `;

    const errorEl = document.getElementById('error-message')!;
    
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        errorEl.style.display = 'none';
        const u = (document.getElementById('username') as HTMLInputElement).value;
        const p = (document.getElementById('password') as HTMLInputElement).value;
        
        if (!u || !p) {
            errorEl.textContent = 'Заполните все поля';
            errorEl.style.display = 'block';
            return;
        }

        try {
            const res = await api.post('/login', { username: u, password: p });
            if (res.access_token) {
                setToken(res.access_token);
                if (res.user_id) {
                    localStorage.setItem('user_id', String(res.user_id));
                }
                state.view = 'dashboard';
                navigate();
            }
        } catch (err: any) {
            errorEl.textContent = err.message || 'Ошибка входа';
            errorEl.style.display = 'block';
        }
    });

    document.getElementById('to-reg')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderRegister(container);
    });

    document.getElementById('reset-pwd')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderResetPassword(container);
    });
}

function renderRegister(container: HTMLElement) {
    container.innerHTML = `
        <div class="center-flex">
            <div class="card" style="max-width: 400px; width: 100%;">
                <div class="text-center mb-4">
                    <h2>Регистрация</h2>
                    <p class="text-secondary">Создайте новый аккаунт</p>
                </div>

                <div class="form-group">
                    <label for="reg-username">Логин</label>
                    <input id="reg-username" type="text" placeholder="Выберите логин">
                </div>

                <div class="form-group">
                    <label for="reg-password">Пароль</label>
                    <input id="reg-password" type="password" placeholder="Придумайте пароль">
                </div>

                <div id="error-message" class="alert alert-danger" style="display: none;"></div>

                <button id="register-btn" class="btn-primary" style="width: 100%; margin-bottom: 1rem;">
                    <i class="fas fa-user-plus"></i> Зарегистрироваться
                </button>

                <button id="back-to-login" class="btn-secondary" style="width: 100%;">
                    Вернуться к входу
                </button>
            </div>
        </div>
    `;

    const errorEl = document.getElementById('error-message')!;

    document.getElementById('register-btn')?.addEventListener('click', async () => {
        errorEl.style.display = 'none';
        const u = (document.getElementById('reg-username') as HTMLInputElement).value;
        const p = (document.getElementById('reg-password') as HTMLInputElement).value;

        if (!u || !p) {
            errorEl.textContent = 'Заполните все поля';
            errorEl.style.display = 'block';
            return;
        }

        try {
            await api.post('/register', { username: u, password: p });
            errorEl.className = 'alert alert-success';
            errorEl.textContent = 'Аккаунт создан! Переход к входу...';
            errorEl.style.display = 'block';
            
            setTimeout(() => {
                renderLogin(container);
                (document.getElementById('username') as HTMLInputElement).value = u;
            }, 1500);
        } catch (err: any) {
            errorEl.className = 'alert alert-danger';
            errorEl.textContent = err.message || 'Ошибка регистрации';
            errorEl.style.display = 'block';
        }
    });

    document.getElementById('back-to-login')?.addEventListener('click', () => {
        renderLogin(container);
    });
}

function renderResetPassword(container: HTMLElement) {
    container.innerHTML = `
        <div class="center-flex">
            <div class="card" style="max-width: 400px; width: 100%;">
                <div class="text-center mb-4">
                    <h2>Сброс пароля</h2>
                    <p class="text-secondary">Введите новый пароль</p>
                </div>

                <div class="form-group">
                    <label for="reset-username">Логин</label>
                    <input id="reset-username" type="text" placeholder="Ваш логин">
                </div>

                <div class="form-group">
                    <label for="reset-password">Новый пароль</label>
                    <input id="reset-password" type="password" placeholder="Новый пароль">
                </div>

                <div id="error-message" class="alert alert-danger" style="display: none;"></div>

                <button id="reset-btn" class="btn-primary" style="width: 100%; margin-bottom: 1rem;">
                    <i class="fas fa-lock"></i> Изменить пароль
                </button>

                <button id="back-to-login" class="btn-secondary" style="width: 100%;">
                    Вернуться к входу
                </button>
            </div>
        </div>
    `;

    const errorEl = document.getElementById('error-message')!;

    document.getElementById('reset-btn')?.addEventListener('click', async () => {
        errorEl.style.display = 'none';
        const u = (document.getElementById('reset-username') as HTMLInputElement).value;
        const p = (document.getElementById('reset-password') as HTMLInputElement).value;

        if (!u || !p) {
            errorEl.textContent = 'Заполните все поля';
            errorEl.style.display = 'block';
            return;
        }

        try {
            await api.post('/reset-password', { username: u, password: p });
            errorEl.className = 'alert alert-success';
            errorEl.textContent = 'Пароль изменен! Переход к входу...';
            errorEl.style.display = 'block';
            
            setTimeout(() => {
                renderLogin(container);
                (document.getElementById('username') as HTMLInputElement).value = u;
            }, 1500);
        } catch (err: any) {
            errorEl.className = 'alert alert-danger';
            errorEl.textContent = err.message || 'Ошибка при сбросе пароля';
            errorEl.style.display = 'block';
        }
    });

    document.getElementById('back-to-login')?.addEventListener('click', () => {
        renderLogin(container);
    });
}
