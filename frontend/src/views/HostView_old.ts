import { connectWS, api } from '../api';
import { navigate } from '../main';
import { state } from '../state';

export function renderHost(container: HTMLElement, roomCode: string) {
    let playersCount = 0;
    let gameStatus = 'waiting'; 
    let socket: WebSocket | null = null;
    let currentQuestionIndex = 0;
    let quizQuestions: any[] = [];

    container.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h2>Панель хоста</h2>
            </div>

            <div class="glass-card" style="padding: 2rem; text-align: center; margin-bottom: 2rem;">
                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">КОД КОМНАТЫ</p>
                <div class="room-code">${roomCode}</div>
                <p style="color: var(--text-secondary);">Поделитесь кодом с игроками</p>
            </div>

            <div class="glass-card" style="padding: 1.5rem; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Статус игры</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <span>Игроков в лобби:</span>
                    <strong style="font-size: 1.5rem; color: var(--primary);">
                        <span id="player-count">0</span>
                    </strong>
                </div>
                <div>
                    <span>Статус:</span>
                    <span id="game-status" class="status-badge status-waiting" style="margin-left: 1rem;">
                        <i class="fas fa-hourglass-start"></i> Ожидание
                    </span>
                </div>
            </div>

            <div id="question-info" style="display: none; margin-bottom: 2rem;">
                <div class="glass-card" style="padding: 1.5rem;">
                    <h4>Текущий вопрос</h4>
                    <p id="current-question" style="margin-top: 0.5rem;"></p>
                    <p style="font-size: 0.875rem; color: var(--text-secondary);">
                        Вопрос <span id="question-index">1</span> из <span id="total-questions">0</span>
                    </p>
                </div>
            </div>

            <div id="controls" style="display: grid; gap: 1rem; margin-bottom: 2rem;">
                <button id="start-btn" class="btn-primary" style="width: 100%;">
                    <i class="fas fa-play"></i> НАЧАТЬ ИГРУ
                </button>
                <button id="next-btn" class="btn-primary" style="width: 100%; display: none;">
                    <i class="fas fa-forward"></i> СЛЕДУЮЩИЙ ВОПРОС
                </button>
                <button id="finish-btn" class="btn-danger" style="width: 100%; display: none;">
                    <i class="fas fa-stop"></i> ЗАВЕРШИТЬ ИГРУ
                </button>
                <button id="leaderboard-btn" class="btn-secondary" style="width: 100%; display: none;">
                    <i class="fas fa-trophy"></i> Показать таблицу лидеров
                </button>
            </div>

            <div id="leaderboard-display" style="display: none; margin-bottom: 2rem;">
                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fas fa-trophy" style="color: var(--warning); margin-right: 0.5rem;"></i>
                        Таблица лидеров
                    </h3>
                    <div id="leaderboard-list"></div>
                </div>
            </div>

            <button id="back-btn" class="btn-secondary" style="width: 100%;">
                <i class="fas fa-arrow-left"></i> Закрыть комнату
            </button>
        </div>
    `;

    socket = connectWS(roomCode, 'host', (data) => {
        handleMessage(data);
    });

    function handleMessage(data: any) {
        if (data.event === 'player_joined') {
            playersCount = data.participants_count || (playersCount + 1);
            updatePlayerCount();
        } else if (data.event === 'leaderboard') {
            displayLeaderboard(data.leaderboard);
        }
    }

    function updatePlayerCount() {
        const el = document.getElementById('player-count');
        if (el) el.textContent = String(playersCount);
    }

    async function loadQuizQuestions() {
        try {
            const quizId = 1; 
            const response = await api.get(`/quizzes/${quizId}/questions`);
            quizQuestions = response;
            document.getElementById('total-questions')!.textContent = String(quizQuestions.length);
        } catch (err) {
            console.error('Failed to load questions:', err);
        }
    }

    loadQuizQuestions();

    const startBtn = document.getElementById('start-btn')!;
    const nextBtn = document.getElementById('next-btn')!;
    const finishBtn = document.getElementById('finish-btn')!;
    const leaderboardBtn = document.getElementById('leaderboard-btn')!;
    const statusEl = document.getElementById('game-status')!;
    const questionInfoEl = document.getElementById('question-info')!;

    startBtn.addEventListener('click', () => {
        if (quizQuestions.length === 0) {
            alert('В викторине нет вопросов!');
            return;
        }
        
        gameStatus = 'active';
        currentQuestionIndex = 0;
        updateUI();
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'start_quiz' }));
        }
    });

    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < quizQuestions.length) {
            updateUI();
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ action: 'next_question' }));
            }
        } else {
            finishGame();
        }
    });

    finishBtn.addEventListener('click', finishGame);

    leaderboardBtn.addEventListener('click', async () => {
        try {
            const response = await api.get(`/rooms/${roomCode}/leaderboard`);
            displayLeaderboard(response.leaderboard);
        } catch (err) {
            console.error('Failed to load leaderboard:', err);
        }
    });

    function finishGame() {
        gameStatus = 'finished';
        updateUI();
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'finish_quiz' }));
        }
    }

    function updateUI() {
        const statusTexts: {[key: string]: any} = {
            'waiting': { icon: 'hourglass-start', text: 'Ожидание', class: 'status-waiting' },
            'active': { icon: 'play-circle', text: 'В процессе', class: 'status-active' },
            'finished': { icon: 'flag-checkered', text: 'Завершено', class: 'status-finished' }
        };
        
        const status = statusTexts[gameStatus];
        statusEl.className = `status-badge ${status.class}`;
        statusEl.innerHTML = `<i class="fas fa-${status.icon}"></i> ${status.text}`;

        startBtn.style.display = gameStatus === 'waiting' ? 'block' : 'none';
        nextBtn.style.display = gameStatus === 'active' && currentQuestionIndex < quizQuestions.length ? 'block' : 'none';
        finishBtn.style.display = gameStatus === 'active' ? 'block' : 'none';
        leaderboardBtn.style.display = gameStatus === 'finished' ? 'block' : 'none';

        if (gameStatus === 'active' && currentQuestionIndex < quizQuestions.length) {
            questionInfoEl.style.display = 'block';
            const q = quizQuestions[currentQuestionIndex];
            document.getElementById('current-question')!.textContent = q.text;
            document.getElementById('question-index')!.textContent = String(currentQuestionIndex + 1);
        } else {
            questionInfoEl.style.display = 'none';
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

    document.getElementById('back-btn')?.addEventListener('click', () => {
        if (socket) socket.close();
        state.roomCode = '';
        state.view = 'dashboard';
        navigate();
    });
}
