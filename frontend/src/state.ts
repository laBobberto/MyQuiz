export const state = {
    token: localStorage.getItem('token'),
    user_id: localStorage.getItem('user_id'),
    view: localStorage.getItem('token') ? 'dashboard' : 'login', 
    roomCode: '',
    quizId: parseInt(localStorage.getItem('quizId') || '0'),
    playerNickname: '',
    currentQuestion: null as any,
};

export function setToken(token: string) {
    state.token = token;
    localStorage.setItem('token', token);
}

export function setUserId(userId: number) {
    state.user_id = String(userId);
    localStorage.setItem('user_id', String(userId));
}

export function setQuizId(quizId: number) {
    state.quizId = quizId;
    localStorage.setItem('quizId', String(quizId));
}