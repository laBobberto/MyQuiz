import { state, setQuizId } from './state';
import { api } from './api';
import { navigate } from './main';
import { showQuestionsList, showQuestionDialog } from './utils';

export function renderDashboard(container: HTMLElement) {
    let selectedQuizId = state.quizId || 1;
    let categories: any[] = [];
    let allQuizzes: any[] = [];
    let selectedCategory = 'all';

    container.innerHTML = `
        <div>
            <div class="header">
                <div class="logo">MY<span style="color: var(--success);">QUIZ</span></div>
                <div class="header-actions">
                    <button id="history-btn" class="btn-secondary" style="margin-right: 0.5rem;">
                        <i class="fas fa-history"></i> История
                    </button>
                    <button id="profile-btn" class="btn-secondary" style="margin-right: 0.5rem;">
                        <i class="fas fa-user-circle"></i> Профиль
                    </button>
                    <button id="logout-btn" class="btn-secondary">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>

            <div style="max-width: 1200px; margin: 0 auto;">
                <div class="mb-4">
                    <h1 class="mb-2">Добро пожаловать!</h1>
                    <p class="text-secondary">Создавайте викторины и играйте с друзьями</p>
                </div>

                <div class="grid grid-2 mb-4">
                    <div class="glass-card" style="padding: 2rem; text-align: center; cursor: pointer; transition: var(--transition);" id="host-card">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">
                            <i class="fas fa-crown"></i>
                        </div>
                        <h3>Я ведущий</h3>
                        <p class="text-secondary mb-3">Создайте комнату и проведите викторину</p>
                        <button class="btn-primary" style="width: 100%;">
                            <i class="fas fa-plus"></i> Создать комнату
                        </button>
                    </div>

                    <div class="glass-card" style="padding: 2rem; text-align: center; cursor: pointer; transition: var(--transition);" id="player-card">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">
                            <i class="fas fa-gamepad"></i>
                        </div>
                        <h3>Я игрок</h3>
                        <p class="text-secondary mb-3">Введите код и присоединитесь к игре</p>
                        <button class="btn-success" style="width: 100%;">
                            <i class="fas fa-sign-in-alt"></i> Войти в игру
                        </button>
                    </div>
                </div>

                <div style="margin-top: 3rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h2 class="mb-0"><i class="fas fa-puzzle-piece"></i> Мои викторины</h2>
                        <select id="category-filter" style="padding: 0.5rem; border-radius: 8px; border: 1px solid var(--border);">
                            <option value="all">Все категории</option>
                        </select>
                    </div>

                    <div id="quiz-list" class="grid grid-2 mb-3">
                        <div class="loading text-center" style="grid-column: 1/-1;">
                            <div class="spinner"></div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-bottom: 2rem;">
                        <button id="create-quiz-btn" class="btn-primary">
                            <i class="fas fa-plus"></i> Создать новую викторину
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    api.get('/categories').then(cats => {
        categories = cats;
        const select = document.getElementById('category-filter') as HTMLSelectElement;
        cats.forEach((c: any) => {
            const opt = document.createElement('option');
            opt.value = String(c.id);
            opt.textContent = c.name;
            select.appendChild(opt);
        });
        
        select.addEventListener('change', () => {
            selectedCategory = select.value;
            renderQuizList();
        });
    });

    loadQuizzes();

    document.getElementById('host-card')?.addEventListener('click', () => showCreateRoomDialog(container, selectedQuizId));
    document.getElementById('player-card')?.addEventListener('click', () => { state.view = 'player'; navigate(); });
    document.getElementById('create-quiz-btn')?.addEventListener('click', () => showCreateQuizDialog(container, categories));
    document.getElementById('logout-btn')?.addEventListener('click', () => { localStorage.clear(); location.reload(); });
    
    document.getElementById('profile-btn')?.addEventListener('click', () => {
        state.view = 'profile';
        navigate();
    });

    document.getElementById('history-btn')?.addEventListener('click', () => {
        state.view = 'history';
        navigate();
    });

    function loadQuizzes() {
        api.get('/quizzes')
            .then((quizzes: any[]) => {
                allQuizzes = quizzes;
                renderQuizList();
            })
            .catch((_err) => {
                const listEl = document.getElementById('quiz-list')!;
                listEl.innerHTML = `<div class="alert alert-danger" style="grid-column: 1/-1;">Ошибка загрузки</div>`;
            });
    }

    function renderQuizList() {
        const listEl = document.getElementById('quiz-list')!;
        const filtered = selectedCategory === 'all' 
            ? allQuizzes 
            : allQuizzes.filter(q => String(q.category_id) === selectedCategory);

        if (filtered.length === 0) {
            listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><p class="text-secondary">Нет викторин</p></div>`;
            return;
        }

        listEl.innerHTML = filtered.map((quiz: any) => `
            <div class="glass-card" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem;">${quiz.title}</h4>
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                    ${quiz.questions.length} вопросов • ⏱️ ${quiz.default_timer_seconds}с
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <button class="btn-primary" data-quiz-id="${quiz.id}" style="padding: 0.5rem;">
                        <i class="fas fa-play"></i> Начать
                    </button>
                    <button class="btn-secondary" data-edit-id="${quiz.id}" style="padding: 0.5rem;">
                        <i class="fas fa-edit"></i> Изменить
                    </button>
                </div>
            </div>
        `).join('');

        listEl.querySelectorAll('[data-quiz-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const qid = (e.target as HTMLElement).closest('[data-quiz-id]')?.getAttribute('data-quiz-id');
                if (qid) {
                    selectedQuizId = parseInt(qid);
                    showCreateRoomDialog(container, selectedQuizId);
                }
            });
        });

        listEl.querySelectorAll('[data-edit-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const qid = (e.target as HTMLElement).closest('[data-edit-id]')?.getAttribute('data-edit-id');
                if (qid) {
                    showEditQuizDialog(container, parseInt(qid), categories, () => loadQuizzes());
                }
            });
        });
    }
    
    document.querySelector('[data-quiz-id]')?.addEventListener('click', function(this: HTMLElement) {
        const qid = this.getAttribute('data-quiz-id');
        if (qid) selectedQuizId = parseInt(qid);
    });
}

function showCreateRoomDialog(_container: HTMLElement, quizId: number) {
    const overlay = document.createElement('div');
   overlay.style.cssText = `
       position: fixed; top: 0; left: 0; right: 0; bottom: 0;
       background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;
   `;

   overlay.innerHTML = `
       <div class="card" style="max-width: 400px; width: 90%;">
           <h2 class="mb-3">Создание комнаты</h2>
           <p class="text-secondary mb-3">Викторина будет доступна по коду.</p>
           <div id="error-message" class="alert alert-danger" style="display: none;"></div>
           <button id="confirm-create" class="btn-primary" style="width: 100%; margin-bottom: 1rem;">Создать</button>
           <button id="cancel-create" class="btn-secondary" style="width: 100%;">Отмена</button>
       </div>
   `;
   document.body.appendChild(overlay);
   const errorEl = overlay.querySelector('#error-message') as HTMLElement;
   overlay.querySelector('#confirm-create')?.addEventListener('click', async () => {
       try {
           setQuizId(quizId);
           const res = await api.post(`/rooms/create/${quizId}`, {});
           if (res.code) {
               state.roomCode = res.code;
               state.view = 'host';
               document.body.removeChild(overlay);
               navigate();
           }
       } catch (err: any) {
           errorEl.textContent = err.message; errorEl.style.display = 'block';
       }
   });
   overlay.querySelector('#cancel-create')?.addEventListener('click', () => document.body.removeChild(overlay));
}

function showCreateQuizDialog(_container: HTMLElement, categories: any[]) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; overflow-y: auto;
    `;

    overlay.innerHTML = `
        <div class="card" style="max-width: 500px; width: 90%; margin: 2rem auto;">
            <h2 class="mb-3">Создание викторины</h2>
            
            <div class="form-group">
                <label>Название</label>
                <input id="quiz-title" type="text" placeholder="Введите название">
            </div>

            <div class="form-group">
                <label>Категория</label>
                <select id="quiz-category" style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; width: 100%;">
                    ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>Таймер по умолчанию (сек)</label>
                <input id="quiz-timer" type="number" value="20" min="5">
            </div>

            <div class="form-group">
                <label>Описание</label>
                <textarea id="quiz-description" style="resize: vertical; min-height: 80px;"></textarea>
            </div>

            <div id="error-message" class="alert alert-danger" style="display: none;"></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <button id="confirm-quiz" class="btn-primary">Создать</button>
                <button id="cancel-quiz" class="btn-secondary">Отмена</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-quiz')?.addEventListener('click', async () => {
        const title = (overlay.querySelector('#quiz-title') as HTMLInputElement).value.trim();
        const desc = (overlay.querySelector('#quiz-description') as HTMLTextAreaElement).value.trim();
        const catId = (overlay.querySelector('#quiz-category') as HTMLSelectElement).value;
        const timer = (overlay.querySelector('#quiz-timer') as HTMLInputElement).value;

        if (!title) return;

        try {
            const res = await api.post('/quizzes', {
                title,
                description: desc || null,
                category_id: parseInt(catId),
                default_timer_seconds: parseInt(timer)
            });
            
            if (res.id) {
                document.body.removeChild(overlay);
                const dashboard = document.querySelector('[class*="grid"]');
                if (dashboard) renderDashboard(dashboard.parentElement!);
            }
        } catch (err: any) {
            const errEl = overlay.querySelector('#error-message') as HTMLElement;
            errEl.textContent = err.message;
            errEl.style.display = 'block';
        }
    });

    overlay.querySelector('#cancel-quiz')?.addEventListener('click', () => document.body.removeChild(overlay));
}

async function showEditQuizDialog(container: HTMLElement, quizId: number, categories: any[], onSave: () => void) {
    let quiz: any = null;
    try {
        quiz = await api.get(`/quizzes/${quizId}`);
    } catch (err) { return; }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; overflow-y: auto;
    `;

    overlay.innerHTML = `
        <div class="card" style="max-width: 600px; width: 90%; margin: 2rem auto;">
            <h2 class="mb-3">Редактирование</h2>
            <div class="form-group"><label>Название</label><input id="edit-quiz-title" type="text" value="${quiz.title}"></div>
            <div class="form-group">
                <label>Категория</label>
                <select id="edit-quiz-category" style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; width: 100%;">
                    ${categories.map(c => `<option value="${c.id}" ${c.id === quiz.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Таймер (сек)</label><input id="edit-quiz-timer" type="number" value="${quiz.default_timer_seconds}"></div>
            <div class="form-group"><label>Описание</label><textarea id="edit-quiz-description">${quiz.description || ''}</textarea></div>
            
            <div class="form-group">
                <button id="manage-questions" class="btn-secondary" style="width: 100%;">Управление вопросами (${quiz.questions.length})</button>
            </div>
             <div class="form-group" style="margin-top: 1rem;">
                <button id="add-new-question" class="btn-success" style="width: 100%;">+ Новый вопрос</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem;">
                <button id="save-quiz" class="btn-primary">Сохранить</button>
                <button id="delete-quiz" class="btn-danger">Удалить</button>
            </div>
             <button id="cancel-edit" class="btn-secondary" style="width: 100%; margin-top: 1rem;">Закрыть</button>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#save-quiz')?.addEventListener('click', async () => {
        const title = (overlay.querySelector('#edit-quiz-title') as HTMLInputElement).value;
        const desc = (overlay.querySelector('#edit-quiz-description') as HTMLTextAreaElement).value;
        const catId = (overlay.querySelector('#edit-quiz-category') as HTMLSelectElement).value;
        const timer = (overlay.querySelector('#edit-quiz-timer') as HTMLInputElement).value;

        try {
            await api.put(`/quizzes/${quizId}`, {
                title, description: desc, category_id: parseInt(catId), default_timer_seconds: parseInt(timer)
            });
            document.body.removeChild(overlay);
            onSave();
        } catch (err) { alert('Ошибка'); }
    });

    overlay.querySelector('#delete-quiz')?.addEventListener('click', async () => {
        if (confirm('Удалить викторину?')) {
            try { await api.delete(`/quizzes/${quizId}`); document.body.removeChild(overlay); onSave(); } catch (e) { alert('Ошибка'); }
        }
    });

    overlay.querySelector('#manage-questions')?.addEventListener('click', () => {
         api.get(`/quizzes/${quizId}/questions`).then(qs => showQuestionsList(container, qs, () => {}));
    });

    overlay.querySelector('#add-new-question')?.addEventListener('click', () => {
        const defaultTimer = parseInt((overlay.querySelector('#edit-quiz-timer') as HTMLInputElement).value);
        showQuestionDialog(quizId, defaultTimer, null, () => {
            alert('Вопрос добавлен');
        });
    });

    overlay.querySelector('#cancel-edit')?.addEventListener('click', () => document.body.removeChild(overlay));
}