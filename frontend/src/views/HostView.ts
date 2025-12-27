import { connectWS, api } from '../api';
import { navigate } from '../main';
import { state } from '../state';
import { showQuestionDialog, showQuestionsList } from '../utils';

interface Question {
    id: number;
    text: string;
    timer_seconds: number;
    question_type: string;
    choices: Array<{ id: number; text: string; is_correct: boolean }>;
}

export function renderHost(container: HTMLElement, roomCode: string) {
    let playersCount = 0; 
    let gameStatus = 'waiting'; 
    let socket: WebSocket | null = null;
    let currentQuestionIndex = 0;
    let quizQuestions: Question[] = [];
    let quizId = state.quizId || 1;
    let waitingPlayers: any[] = [];

    container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto;">
            <div class="header" style="margin-bottom: 2rem;">
                <div class="logo">MY<span style="color: var(--success);">QUIZ</span> - Панель Хоста</div>
                <button id="exit-btn" class="btn-secondary">
                    <i class="fas fa-sign-out-alt"></i> Выход
                </button>
            </div>

            <div class="grid grid-2">
                <div class="glass-card" style="padding: 2rem;">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fas fa-door-open"></i> Комната
                    </h3>
                    <div style="text-align: center; margin-bottom: 1.5rem;">
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">КОД</p>
                        <div class="room-code" style="font-size: 2.5rem; letter-spacing: 3px;">${roomCode}</div>
                    </div>
                    <div style="background: var(--light); padding: 1rem; border-radius: 8px; text-align: center;">
                        <p style="margin-bottom: 0.5rem;">Активных игроков: <strong style="color: var(--primary); font-size: 1.5rem;">
                            <span id="player-count">0</span>
                        </strong></p>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">Статус: 
                            <span id="game-status" class="status-badge status-waiting">
                                <i class="fas fa-hourglass-start"></i> Ожидание
                            </span>
                        </p>
                    </div>
                </div>

                <div class="glass-card" style="padding: 2rem;">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fas fa-question-circle"></i> Вопросы
                    </h3>
                    <div id="questions-info" style="background: var(--light); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <p style="text-align: center; color: var(--text-secondary);">
                            Вопросов: <strong style="color: var(--primary); font-size: 1.2rem;">
                                <span id="question-count">0</span>
                            </strong>
                        </p>
                    </div>
                    <button id="manage-questions-btn" class="btn-primary" style="width: 100%; margin-bottom: 0.5rem;">
                        <i class="fas fa-edit"></i> Управлять вопросами
                    </button>
                    <button id="view-questions-btn" class="btn-secondary" style="width: 100%;">
                        <i class="fas fa-list"></i> Просмотреть список
                    </button>
                </div>
            </div>

            <div class="glass-card" style="padding: 2rem; margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;"><i class="fas fa-user-clock"></i> Запросы на вход</h3>
                <div id="waiting-list-container">
                    <p class="text-secondary">Нет ожидающих игроков</p>
                </div>
            </div>

            <div class="glass-card" style="padding: 2rem; margin-top: 2rem; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1.5rem;">
                    <i class="fas fa-gamepad"></i> Управление игрой
                </h3>
                <div id="game-controls" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <button id="start-btn" class="btn-primary" style="padding: 1rem;">
                        <i class="fas fa-play"></i><br>Начать игру
                    </button>
                    <button id="next-btn" class="btn-primary" style="padding: 1rem; display: none;">
                        <i class="fas fa-forward"></i><br>Следующий вопрос
                    </button>
                    <button id="pause-btn" class="btn-warning" style="padding: 1rem; display: none; background: #f59e0b;">
                        <i class="fas fa-pause"></i><br>Пауза
                    </button>
                    <button id="resume-btn" class="btn-success" style="padding: 1rem; display: none; background: var(--success);">
                        <i class="fas fa-play"></i><br>Продолжить
                    </button>
                    <button id="finish-btn" class="btn-danger" style="padding: 1rem; display: none;">
                        <i class="fas fa-stop"></i><br>Завершить
                    </button>
                </div>
            </div>

            <div id="current-question-info" style="display: none;">
                <div class="glass-card" style="padding: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Текущий вопрос</h3>
                    <p id="current-question-text" style="font-size: 1.1rem; margin-bottom: 1rem;"></p>
                    <p style="color: var(--text-secondary);">
                        <span id="question-number"></span> / <span id="total-questions"></span>
                    </p>
                </div>
            </div>

            <div id="leaderboard-display" style="display: none; margin-top: 2rem;">
                <div class="glass-card" style="padding: 2rem;">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fas fa-trophy" style="color: var(--warning); margin-right: 0.5rem;"></i>
                        Итоговая таблица лидеров
                    </h3>
                    <div id="leaderboard-list"></div>
                </div>
            </div>

            <div id="quiz-selection" style="display: none; margin-top: 2rem; margin-bottom: 2rem;">
                <div class="glass-card" style="padding: 2rem;">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fas fa-tasks"></i> Выбрать следующую викторину
                    </h3>
                    <div id="quiz-list" style="display: grid; gap: 0.5rem; max-height: 300px; overflow-y: auto;"></div>
                    <button id="continue-without-quiz-btn" class="btn-secondary" style="width: 100%; margin-top: 1rem;">
                        Ждать выбора
                    </button>
                </div>
            </div>
        </div>
    `;

    function updatePlayerCount() {
        const el = document.getElementById('player-count');
        if (el) el.textContent = String(playersCount);
    }

    function updateQuestionCount() {
        const el = document.getElementById('question-count');
        if (el) el.textContent = String(quizQuestions.length);
    }

    function renderWaitingList() {
        const container = document.getElementById('waiting-list-container')!;
        if (waitingPlayers.length === 0) {
            container.innerHTML = '<p class="text-secondary">Нет ожидающих игроков</p>';
            return;
        }

        container.innerHTML = `
            <div style="display: grid; gap: 0.5rem;">
                ${waitingPlayers.map(p => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--light); padding: 0.75rem; border-radius: 8px;">
                        <span>${p.username} (ID: ${p.user_id})</span>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn-success approve-btn" data-id="${p.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                                <i class="fas fa-check"></i> Принять
                            </button>
                            <button class="btn-danger reject-btn" data-id="${p.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                                <i class="fas fa-times"></i> Отклонить
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pid = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id')!);
                if (socket) {
                    socket.send(JSON.stringify({ action: 'approve_player', participant_id: pid }));
                    waitingPlayers = waitingPlayers.filter(p => p.id !== pid);
                    renderWaitingList();
                }
            });
        });

        container.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pid = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id')!);
                if (socket) {
                    socket.send(JSON.stringify({ action: 'reject_player', participant_id: pid }));
                    waitingPlayers = waitingPlayers.filter(p => p.id !== pid);
                    renderWaitingList();
                }
            });
        });
    }

    function updateStatus(newStatus: string) {
        gameStatus = newStatus;
        const statusEl = document.getElementById('game-status')!;
        
        const statusTexts: {[key: string]: any} = {
            'waiting': { icon: 'hourglass-start', text: 'Ожидание', class: 'status-waiting' },
            'active': { icon: 'play-circle', text: 'В процессе', class: 'status-active' },
            'paused': { icon: 'pause-circle', text: 'На паузе', class: 'status-warning' },
            'finished': { icon: 'flag-checkered', text: 'Завершено', class: 'status-finished' },
            'waiting_for_next': { icon: 'check-circle', text: 'Завершено', class: 'status-finished' }
        };
        
        const status = statusTexts[gameStatus] || statusTexts['waiting'];
        statusEl.className = `status-badge ${status.class}`;
        statusEl.innerHTML = `<i class="fas fa-${status.icon}"></i> ${status.text}`;

        document.getElementById('start-btn')!.style.display = gameStatus === 'waiting' ? 'block' : 'none';
        document.getElementById('next-btn')!.style.display = gameStatus === 'active' && currentQuestionIndex < quizQuestions.length - 1 ? 'block' : 'none';
        document.getElementById('pause-btn')!.style.display = gameStatus === 'active' ? 'block' : 'none';
        document.getElementById('resume-btn')!.style.display = gameStatus === 'paused' ? 'block' : 'none';
        document.getElementById('finish-btn')!.style.display = (gameStatus === 'active' || gameStatus === 'paused') ? 'block' : 'none';
    }

    async function loadQuestions() {
        try {
            const response = await api.get(`/quizzes/${quizId}/questions`);
            quizQuestions = response;
            updateQuestionCount();
        } catch (err) {
            console.error('Failed to load questions:', err);
        }
    }

    socket = connectWS(roomCode, 'host', (data) => {
        if (data.event === 'player_request') {
            if (!waitingPlayers.some(p => p.id === data.participant.id)) {
                waitingPlayers.push(data.participant);
                renderWaitingList();
            }
        } 
        else if (data.event === 'player_approved') {
             waitingPlayers = waitingPlayers.filter(p => p.id !== data.participant_id);
             renderWaitingList();
        }
        else if (data.event === 'player_rejected') {
             waitingPlayers = waitingPlayers.filter(p => p.id !== data.participant_id);
             renderWaitingList();
        }
        else if (data.event === 'participants_update') {
            playersCount = data.count;
            updatePlayerCount();
        }
        else if (data.event === 'player_joined') {
            if (data.participants_count) {
                playersCount = data.participants_count;
                updatePlayerCount();
            }
        } 
        else if (data.event === 'leaderboard') {
            displayLeaderboard(data.leaderboard);
        }
        else if (data.event === 'show_results') {
            displayLeaderboard(data.leaderboard);
        }
        else if (data.event === 'quiz_finished') {
            updateStatus('waiting_for_next');
            if (data.leaderboard) {
                displayLeaderboard(data.leaderboard);
            } else {
                showLeaderboard();
            }
            loadAvailableQuizzes();
        }
        else if (data.event === 'quiz_changed') {
            quizId = data.quiz_id;
            loadQuestions();
            const quizSelection = document.getElementById('quiz-selection');
            if (quizSelection) quizSelection.style.display = 'none';
            const leaderboardDisplay = document.getElementById('leaderboard-display');
            if (leaderboardDisplay) leaderboardDisplay.style.display = 'none';
            updateStatus('waiting');
        }
    });

    loadQuestions();

    document.getElementById('manage-questions-btn')?.addEventListener('click', () => {
        showQuestionDialog(quizId, null, null, () => {
            loadQuestions();
        });
    });

    document.getElementById('view-questions-btn')?.addEventListener('click', () => {
        showQuestionsList(container, quizQuestions, () => {
            loadQuestions();
        });
    });

    document.getElementById('start-btn')?.addEventListener('click', () => {
        if (quizQuestions.length === 0) {
            alert('Добавьте вопросы перед началом игры!');
            return;
        }
        document.getElementById('leaderboard-display')!.style.display = 'none';
        updateStatus('active');
        currentQuestionIndex = 0;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'start_quiz' }));
        }
        showCurrentQuestion();
    });

    document.getElementById('next-btn')?.addEventListener('click', () => {
        if (currentQuestionIndex + 1 < quizQuestions.length) {
            currentQuestionIndex++;
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ action: 'next_question' }));
            }
            showCurrentQuestion();
            updateStatus(gameStatus);
        }
    });

    document.getElementById('pause-btn')?.addEventListener('click', () => {
        updateStatus('paused');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'pause_quiz' }));
        }
    });

    document.getElementById('resume-btn')?.addEventListener('click', () => {
        updateStatus('active');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'resume_quiz' }));
        }
    });

    document.getElementById('finish-btn')?.addEventListener('click', () => {
        updateStatus('waiting_for_next');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'finish_quiz' }));
        }
        setTimeout(() => {
            showLeaderboard();
            loadAvailableQuizzes();
        }, 500);
    });

    document.getElementById('exit-btn')?.addEventListener('click', () => {
        if (socket) socket.close();
        state.roomCode = '';
        state.view = 'dashboard';
        navigate();
    });

    document.getElementById('continue-without-quiz-btn')?.addEventListener('click', () => {
        const quizSelection = document.getElementById('quiz-selection');
        if (quizSelection) quizSelection.style.display = 'none';
    });

    function showCurrentQuestion() {
        const infoDiv = document.getElementById('current-question-info')!;
        if (currentQuestionIndex < quizQuestions.length) {
            const q = quizQuestions[currentQuestionIndex];
            document.getElementById('current-question-text')!.textContent = q.text;
            document.getElementById('question-number')!.textContent = String(currentQuestionIndex + 1);
            document.getElementById('total-questions')!.textContent = String(quizQuestions.length);
            infoDiv.style.display = 'block';
        }
    }

    function displayLeaderboard(leaders: any[]) {
        const display = document.getElementById('leaderboard-display')!;
        const list = document.getElementById('leaderboard-list')!;

        if (!leaders || leaders.length === 0) {
            list.innerHTML = '<p class="text-secondary">Нет данных</p>';
            display.style.display = 'block';
            return;
        }

        list.innerHTML = leaders.map((entry: any, idx: number) => {
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[idx] || '•';
            return `
                <div class="leaderboard-entry">
                    <span class="leaderboard-rank">${medal}</span>
                    <span class="leaderboard-name">${entry.username || `Игрок ${entry.user_id}`}</span>
                    <span class="leaderboard-score">${Math.round(entry.score)}</span>
                </div>
            `;
        }).join('');
        
        display.style.display = 'block';
    }

    function showLeaderboard() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'show_leaderboard' }));
        }
    }

    async function loadAvailableQuizzes() {
        try {
            const quizzes = await api.get(`/rooms/${roomCode}/host-quizzes`);
            const quizList = document.getElementById('quiz-list')!;
            const quizSelection = document.getElementById('quiz-selection')!;
            
            quizList.innerHTML = quizzes.map((q: any) => `
                <button class="select-quiz-btn" data-quiz-id="${q.id}" style="padding: 0.75rem; text-align: left; background: var(--light); border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                    <div style="font-weight: bold;">${q.title}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">${q.questions?.length || 0} вопросов</div>
                </button>
            `).join('');
            
            quizList.querySelectorAll('.select-quiz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const quizId = parseInt((e.currentTarget as HTMLElement).getAttribute('data-quiz-id')!);
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ action: 'change_quiz', quiz_id: quizId }));
                    }
                });
                btn.addEventListener('mouseenter', function(this: HTMLElement) {
                    this.style.background = '#e0e0e0';
                });
                btn.addEventListener('mouseleave', function(this: HTMLElement) {
                    this.style.background = 'var(--light)';
                });
            });
            
            quizSelection.style.display = 'block';
        } catch (err) {
            console.error('Failed to load available quizzes:', err);
        }
    }
}
