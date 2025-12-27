import { api } from './api';

export function showQuestionsList(_container: HTMLElement, questions: any[], onUpdate: () => void) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        overflow-y: auto;
    `;

    overlay.innerHTML = `
        <div class="card" style="max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; margin: 2rem auto;">
            <h2 class="mb-3">Вопросы (${questions.length})</h2>
            
            <div id="questions-list"></div>

            <button id="close-list" class="btn-primary" style="width: 100%; margin-top: 1rem;">
                Закрыть
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    const listDiv = overlay.querySelector('#questions-list')!;
    
    function render() {
        if (questions.length === 0) {
            listDiv.innerHTML = '<p class="text-secondary text-center">Нет вопросов</p>';
            return;
        }

        listDiv.innerHTML = questions.map((q, idx) => `
            <div class="glass-card" style="padding: 1.5rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <div>
                        <h4 style="margin-bottom: 0.5rem;">Вопрос ${idx + 1}</h4>
                        <p>${q.text}</p>
                        <p style="font-size: 0.875rem; color: var(--text-secondary);">
                            ⏱️ ${q.timer_seconds}с | ${q.question_type === 'single' ? '✓ Один ответ' : '✓✓ Множественный'}
                        </p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-secondary edit-q-btn" data-id="${q.id}" style="padding: 0.5rem 1rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger delete-q-btn" data-id="${q.id}" style="padding: 0.5rem 1rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div style="background: var(--light); padding: 1rem; border-radius: 8px;">
                    ${q.choices.map((c: any) => `
                        <p style="margin-bottom: 0.5rem; font-size: 0.9rem;">
                            ${c.is_correct ? '✓' : '○'} ${c.text}
                        </p>
                    `).join('')}
                </div>
            </div>
        `).join('');

        listDiv.querySelectorAll('.delete-q-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(!confirm('Удалить этот вопрос?')) return;
                const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id')!);
                try {
                    await api.delete(`/questions/${id}`);
                    questions = questions.filter(q => q.id !== id);
                    render();
                    onUpdate();
                } catch (err) {
                    alert('Ошибка удаления');
                }
            });
        });
        
        listDiv.querySelectorAll('.edit-q-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                 const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id')!);
                 const question = questions.find(q => q.id === id);
                 if (question) {
                     showQuestionDialog(question.quiz_id, null, question, () => {
                         document.body.removeChild(overlay);
                         onUpdate();
                     });
                 }
             });
        });
    }

    render();

    overlay.querySelector('#close-list')?.addEventListener('click', () => {
        document.body.removeChild(overlay);
        onUpdate();
    });
}

export function showQuestionDialog(quizId: number, defaultTimer: number | null, question: any = null, onSave: () => void) {
    const isEdit = !!question;
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
        overflow-y: auto;
    `;
    
    const initialText = question ? question.text : '';
    const initialTimer = question ? question.timer_seconds : (defaultTimer || 20);
    let choices = question ? JSON.parse(JSON.stringify(question.choices)) : [{text: '', is_correct: false}, {text: '', is_correct: false}];
    
    if (choices.length < 2) choices = [...choices, {text: '', is_correct: false}, {text: '', is_correct: false}].slice(0, 2);

    overlay.innerHTML = `
        <div class="card" style="max-width: 600px; width: 90%; margin: 2rem auto;">
            <h2 class="mb-3">${isEdit ? 'Редактировать вопрос' : 'Добавить вопрос'}</h2>
            
            <div class="form-group">
                <label>Текст вопроса</label>
                <textarea id="q-text" style="width: 100%; min-height: 100px; resize: vertical; padding: 0.75rem;">${initialText}</textarea>
            </div>
            
            <div class="form-group">
                <label>Время на ответ (сек)</label>
                <input type="number" id="q-timer" value="${initialTimer}" min="5">
            </div>

            <div class="form-group">
                <label>Варианты ответов</label>
                <div id="q-choices"></div>
                <button id="add-choice" class="btn-secondary" style="margin-top: 0.5rem; width: 100%;">
                    <i class="fas fa-plus"></i> Добавить вариант
                </button>
            </div>

            <div id="q-error" class="alert alert-danger" style="display: none;"></div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
                <button id="save-q" class="btn-primary">
                    <i class="fas fa-save"></i> Сохранить
                </button>
                <button id="cancel-q" class="btn-secondary">
                    Отмена
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const choicesDiv = overlay.querySelector('#q-choices')!;
    const errorEl = overlay.querySelector('#q-error') as HTMLElement;
    
    function renderChoices() {
        choicesDiv.innerHTML = choices.map((c: any, i: number) => `
            <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem; align-items: center;">
                <div style="flex: 1;">
                    <input type="text" value="${c.text}" class="choice-val" placeholder="Вариант ${i + 1}" style="margin-bottom: 0;">
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
                    <input type="checkbox" ${c.is_correct ? 'checked' : ''} class="choice-corr" style="width: auto; margin: 0; transform: scale(1.2);">
                    <span style="font-size: 0.9rem;">Правильный</span>
                </div>
                <button class="btn-danger remove-choice" data-idx="${i}" style="padding: 0.5rem; width: auto;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        choicesDiv.querySelectorAll('.choice-val').forEach((inp: any, i) => {
            inp.oninput = (e: any) => choices[i].text = e.target.value;
        });
        choicesDiv.querySelectorAll('.choice-corr').forEach((inp: any, i) => {
            inp.onchange = (e: any) => choices[i].is_correct = e.target.checked;
        });
        choicesDiv.querySelectorAll('.remove-choice').forEach((btn: any) => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                if (choices.length > 2) {
                    choices.splice(idx, 1);
                    renderChoices();
                } else {
                    alert('Минимум 2 варианта');
                }
            };
        });
    }
    renderChoices();
    
    overlay.querySelector('#add-choice')?.addEventListener('click', () => {
        choices.push({text: '', is_correct: false});
        renderChoices();
    });
    
    overlay.querySelector('#save-q')?.addEventListener('click', async () => {
        const text = (overlay.querySelector('#q-text') as HTMLTextAreaElement).value.trim();
        const timer = parseInt((overlay.querySelector('#q-timer') as HTMLInputElement).value);
        
        if (!text) {
            errorEl.textContent = 'Введите текст вопроса';
            errorEl.style.display = 'block';
            return;
        }

        const validChoices = choices.filter((c: any) => c.text.trim().length > 0);
        if (validChoices.length < 2) {
            errorEl.textContent = 'Минимум 2 варианта ответа';
            errorEl.style.display = 'block';
            return;
        }
        if (!validChoices.some((c: any) => c.is_correct)) {
            errorEl.textContent = 'Выберите правильный ответ';
            errorEl.style.display = 'block';
            return;
        }

        const payload = {
            text,
            timer_seconds: timer,
            question_type: validChoices.filter((c: any) => c.is_correct).length > 1 ? 'multiple' : 'single',
            choices: validChoices
        };

        try {
            if (isEdit) {
                await api.put(`/questions/${question.id}`, payload);
            } else {
                await api.post(`/quizzes/${quizId}/questions`, payload);
            }
            document.body.removeChild(overlay);
            onSave();
        } catch (e: any) {
            errorEl.textContent = e.message || 'Ошибка сохранения';
            errorEl.style.display = 'block';
        }
    });

    overlay.querySelector('#cancel-q')?.addEventListener('click', () => document.body.removeChild(overlay));
}