import { state } from '../state';
import { connectWS, api } from '../api';
import { navigate } from '../main';

interface Question {
    id: number;
    text: string;
    timer_seconds: number;
    choices: Array<{ id: number; text: string }>;
}

export function renderGameView(container: HTMLElement) {
    if (!state.roomCode) {
        renderJoinForm(container);
    } else {
        renderPlayerGame(container);
    }
}

function renderJoinForm(container: HTMLElement) {
    container.innerHTML = `
        <div class="center-flex">
            <div class="card" style="max-width: 400px; width: 100%;">
                <div class="text-center mb-4">
                    <h2>Присоединиться к игре</h2>
                    <p class="text-secondary">Введите код комнаты и ваш псевдоним</p>
                </div>

                <div class="form-group">
                    <label for="room-input">Код комнаты</label>
                    <input id="room-input" type="text" placeholder="Код из 6 букв" maxlength="6" style="text-transform: uppercase; text-align: center; font-size: 1.5rem; font-weight: bold; letter-spacing: 5px;">
                </div>

                <div class="form-group">
                    <label for="nickname-input">Ваш псевдоним</label>
                    <input id="nickname-input" type="text" placeholder="Введите псевдоним" maxlength="30">
                </div>

                <div id="error-message" class="alert alert-danger" style="display: none;"></div>

                <button id="join-btn" class="btn-primary" style="width: 100%; margin-bottom: 1rem;">
                    <i class="fas fa-door-open"></i> Войти
                </button>

                <button id="back-btn" class="btn-secondary" style="width: 100%;">
                    <i class="fas fa-arrow-left"></i> Назад
                </button>
            </div>
        </div>
    `;

    const errorEl = document.getElementById('error-message')!;
    const roomInput = document.getElementById('room-input') as HTMLInputElement;
    const nicknameInput = document.getElementById('nickname-input') as HTMLInputElement;

    roomInput.addEventListener('input', (e) => {
        (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase();
    });

    document.getElementById('join-btn')?.addEventListener('click', async () => {
        errorEl.style.display = 'none';
        const code = roomInput.value.toUpperCase();
        const nickname = nicknameInput.value.trim();
        
        if (code.length !== 6) {
            errorEl.textContent = 'Код должен состоять из 6 символов';
            errorEl.style.display = 'block';
            return;
        }

        if (!nickname) {
            errorEl.textContent = 'Пожалуйста, введите псевдоним';
            errorEl.style.display = 'block';
            return;
        }

        try {
            await api.get(`/rooms/${code}`);
            state.roomCode = code;
            state.playerNickname = nickname;
            renderPlayerGame(container);
        } catch (err: any) {
            errorEl.textContent = 'Комната не найдена';
            errorEl.style.display = 'block';
        }
    });

    document.getElementById('back-btn')?.addEventListener('click', () => {
        state.roomCode = '';
        state.view = 'dashboard';
        navigate();
    });
}

function renderPlayerGame(container: HTMLElement) {
    let currentQuestion: Question | null = null;
    let socket: WebSocket | null = null;
    let participantId = 0;
    let answered = false;
    let isApproved = false;
    let questionStartTime = 0;  

    container.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h2>Викторина</h2>
                <p class="text-secondary">Код комнаты: <strong style="color: var(--primary);">${state.roomCode}</strong></p>
            </div>

            <div class="timer-bar">
                <div id="timer-progress" class="timer-progress" style="width: 100%;"></div>
            </div>

            <div id="loading" class="loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
                <div class="spinner"></div>
                <p id="loading-text">Подключение...</p>
            </div>

            <div id="approval-wait" class="text-center" style="display: none; padding: 2rem;">
                <i class="fas fa-user-clock" style="font-size: 3rem; color: var(--warning); margin-bottom: 1rem;"></i>
                <h3>Ожидание подтверждения</h3>
                <p class="text-secondary">Хост скоро рассмотрит вашу заявку...</p>
            </div>
            
            <div id="rejected-screen" class="text-center" style="display: none; padding: 2rem;">
                <i class="fas fa-ban" style="font-size: 3rem; color: var(--danger); margin-bottom: 1rem;"></i>
                <h3>Отклонено</h3>
                <p class="text-secondary">Хост отклонил ваш запрос на вход.</p>
                <button class="btn-secondary" id="rejected-back-btn" style="margin-top: 1rem;">Назад</button>
            </div>

            <h3 id="question-text" style="display: none;" class="mb-3"></h3>
            
            <div id="choices-grid" class="choices-grid"></div>

            <div id="result-message" class="alert alert-info" style="display: none; margin-top: 1.5rem;"></div>

            <div id="results-table" style="display: none; margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem; text-align: center;">Таблица результатов</h3>
                <div id="results-list" style="max-height: 300px; overflow-y: auto;"></div>
                <div id="game-finished-actions" style="display: none; margin-top: 1rem;">
                    <button id="stay-in-room-btn" class="btn-primary" style="width: 100%; margin-bottom: 0.5rem;">
                        <i class="fas fa-hourglass-half"></i> Остаться в комнате
                    </button>
                </div>
            </div>

            <button id="leave-btn" class="btn-secondary" style="width: 100%; margin-top: 2rem;">
                <i class="fas fa-sign-out-alt"></i> Выход
            </button>
        </div>
    `;

    socket = connectWS(state.roomCode, 'player', (data) => {
        handleMessage(data);
    });

    setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            const uid = localStorage.getItem('user_id') || '0';
            socket.send(JSON.stringify({ 
                action: 'join_room',
                user_id: uid ? parseInt(uid) : null,
                nickname: state.playerNickname
            }));
        }
    }, 500);

    function handleMessage(data: any) {
        const loadingEl = document.getElementById('loading')!;
        const loadingText = document.getElementById('loading-text')!;
        const approvalWaitEl = document.getElementById('approval-wait')!;
        const rejectedEl = document.getElementById('rejected-screen')!;
        const questionEl = document.getElementById('question-text')!;
        const choicesEl = document.getElementById('choices-grid')!;
        const resultEl = document.getElementById('result-message')!;
        const resultsTableEl = document.getElementById('results-table')!;

        if (data.event === 'waiting_approval') {
            participantId = data.participant_id;
            loadingEl.style.display = 'none';
            approvalWaitEl.style.display = 'block';
        }
        else if (data.event === 'player_approved') {
            if (data.participant_id === participantId) {
                isApproved = true;
                approvalWaitEl.style.display = 'none';
                loadingText.textContent = 'Ожидание начала игры...';
                loadingEl.style.display = 'flex';
            }
        }
        else if (data.event === 'player_rejected') {
            if (data.participant_id === participantId) {
                approvalWaitEl.style.display = 'none';
                loadingEl.style.display = 'none';
                rejectedEl.style.display = 'block';
            }
        }
        else if (data.event === 'joined') {
            participantId = data.participant_id;
            isApproved = true;
            loadingText.textContent = 'Ожидание начала игры...';
            loadingEl.style.display = 'flex';
        } 
        else if (data.event === 'quiz_started' || data.event === 'next_question') {
            if (!isApproved) return;
            
            loadingEl.style.display = 'none';
            approvalWaitEl.style.display = 'none';
            resultsTableEl.style.display = 'none';
            
            answered = false;
            currentQuestion = data.question;
            if (currentQuestion) {
                displayQuestion(currentQuestion);
            }
        } 
        else if (data.event === 'show_results') {
            resultsTableEl.style.display = 'block';
            const resultsList = document.getElementById('results-list')!;
            resultsList.innerHTML = data.leaderboard.map((entry: any, idx: number) => {
                const medals = ['🥇', '🥈', '🥉'];
                const medal = medals[idx] || '•';
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light); margin-bottom: 0.5rem; border-radius: 8px;">
                        <span style="font-size: 1.2rem; margin-right: 0.5rem;">${medal}</span>
                        <span style="flex: 1;">${entry.username}</span>
                        <span style="font-weight: bold; color: var(--primary);">${Math.round(entry.score)}</span>
                    </div>
                `;
            }).join('');
        }
        else if (data.event === 'answer_result') {
            answered = true;
            const points = data.score_earned || 0;
            const isCorrect = data.is_correct;
            
            resultEl.className = isCorrect ? 'alert alert-success' : 'alert alert-danger';
            resultEl.textContent = isCorrect ? 
                `✓ Правильно! +${points} очков` : 
                `✗ Неправильно. 0 очков`;
            resultEl.style.display = 'block';
            
            choicesEl.querySelectorAll('button').forEach(btn => {
                btn.disabled = true;
            });
        } 
        else if (data.event === 'quiz_finished') {
            questionEl.style.display = 'none';
            choicesEl.innerHTML = '';
            resultEl.style.display = 'none';
            resultsTableEl.style.display = 'block';
            
            const resultsList = document.getElementById('results-list')!;
            const finishedActions = document.getElementById('game-finished-actions')!;
            
            resultsList.innerHTML = '<h4 style="text-align: center; margin-bottom: 1rem;">Игра завершена!</h4>' + 
                (data.leaderboard ? data.leaderboard.map((entry: any, idx: number) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const medal = medals[idx] || '•';
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light); margin-bottom: 0.5rem; border-radius: 8px;">
                            <span style="font-size: 1.2rem; margin-right: 0.5rem;">${medal}</span>
                            <span style="flex: 1;">${entry.username}</span>
                            <span style="font-weight: bold; color: var(--primary);">${Math.round(entry.score)}</span>
                        </div>
                    `;
                }).join('') : '');
            
            finishedActions.style.display = 'block';
        }
        else if (data.event === 'quiz_changed') {
            const loadingText = document.getElementById('loading-text')!;
            questionEl.style.display = 'none';
            choicesEl.innerHTML = '';
            resultEl.style.display = 'none';
            resultsTableEl.style.display = 'none';
            loadingText.textContent = `Следующая викторина: ${data.quiz_title}. Ожидание начала...`;
            const loadingEl = document.getElementById('loading')!;
            loadingEl.style.display = 'flex';
            answered = false;
        }
    }

    function displayQuestion(q: Question) {
        const questionEl = document.getElementById('question-text')!;
        const choicesEl = document.getElementById('choices-grid')!;
        const timerEl = document.getElementById('timer-progress')!;
        const resultEl = document.getElementById('result-message')!;
        
        resultEl.style.display = 'none';
        questionEl.style.display = 'block';

        questionEl.textContent = q.text;
        choicesEl.innerHTML = q.choices.map((c: any) => `
            <button class="answer-btn" data-id="${c.id}" ${answered ? 'disabled' : ''}>
                ${c.text}
            </button>
        `).join('');

        questionStartTime = Date.now();

        timerEl.style.transition = 'none';
        timerEl.style.width = '100%';
        setTimeout(() => {
            timerEl.style.transition = `width ${q.timer_seconds}s linear`;
            timerEl.style.width = '0%';
        }, 50);

        choicesEl.querySelectorAll('.answer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!answered && socket && socket.readyState === WebSocket.OPEN) {
                    const responseTime = (Date.now() - questionStartTime) / 1000;  
                    const choiceId = btn.getAttribute('data-id');
                    
                    socket!.send(JSON.stringify({
                        action: 'submit_answer',
                        participant_id: participantId,
                        question_id: q.id,
                        choice_id: parseInt(choiceId!),
                        response_time: responseTime
                    }));
                    
                    answered = true;
                    choicesEl.querySelectorAll('button').forEach(b => b.disabled = true);
                }
            });
        });
    }

    document.getElementById('leave-btn')?.addEventListener('click', () => {
        if (socket) socket.close();
        state.roomCode = '';
        state.view = 'dashboard';
        navigate();
    });

    document.getElementById('rejected-back-btn')?.addEventListener('click', () => {
        if (socket) socket.close();
        state.roomCode = '';
        state.view = 'dashboard';
        navigate();
    });

    document.getElementById('stay-in-room-btn')?.addEventListener('click', () => {
        const finishedActions = document.getElementById('game-finished-actions')!;
        finishedActions.style.display = 'none';
        const resultsTableEl = document.getElementById('results-table')!;
        resultsTableEl.innerHTML = '<h3 style="text-align: center;">Ожидание новой викторины...</h3>';
        const loadingText = document.getElementById('loading-text')!;
        loadingText.textContent = 'Ожидание следующей викторины...';
        const loadingEl = document.getElementById('loading')!;
        loadingEl.style.display = 'flex';
    });
}