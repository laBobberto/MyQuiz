import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from '../api';
import { renderProfile } from '../views/ProfileView';

vi.mock('../main', () => ({
    navigate: vi.fn()
}));

vi.mock('../state', () => ({
    state: { view: 'profile' }
}));

describe('Frontend Tests', () => {

    describe('API Module', () => {
        let fetchMock: any;

        beforeEach(() => {
            localStorage.clear();
            fetchMock = vi.fn();
            (globalThis as any).fetch = fetchMock;
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        describe('GET requests', () => {
            it('should make a GET request with correct headers', async () => {
                /**
                 * Проверка: Форматирование GET-запроса и заголовки.
                 * Ожидаемый результат: Fetch вызван с правильным URL и Content-Type.
                 */
                const mockResponse = { id: 1, title: 'Test Quiz' };
                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse
                });

                const result = await api.get('/quizzes');

                expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/quizzes', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                expect(result).toEqual(mockResponse);
            });

            it('should include auth token in GET request if available', async () => {
                /**
                 * Проверка: Включение заголовка авторизации в GET-запрос.
                 * Ожидаемый результат: Bearer токен включен в заголовки.
                 */
                localStorage.setItem('token', 'test-token-123');
                const mockResponse = { id: 1 };
                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse
                });

                await api.get('/quizzes');

                expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/quizzes', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer test-token-123'
                    }
                });
            });

            it('should throw error on failed GET request', async () => {
                /**
                 * Проверка: Обработка ошибок при сбое GET-запроса.
                 * Ожидаемый результат: Выбрасывает ошибку с текстом статуса.
                 */
                fetchMock.mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found'
                });

                await expect(api.get('/quizzes/999')).rejects.toThrow('HTTP 404: Not Found');
            });
        });

        describe('POST requests', () => {
            it('should make a POST request with correct headers and body', async () => {
                /**
                 * Проверка: Форматирование POST-запроса, заголовки и сериализация JSON тела.
                 * Ожидаемый результат: Fetch вызван с правильным методом, заголовками и строковым телом.
                 */
                const mockResponse = { id: 1, title: 'New Quiz' };
                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse
                });

                const data = { title: 'New Quiz' };
                const result = await api.post('/quizzes', data);

                expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/quizzes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                expect(result).toEqual(mockResponse);
            });

            it('should include auth token in POST request if available', async () => {
                /**
                 * Проверка: Включение заголовка авторизации в POST-запрос.
                 * Ожидаемый результат: Bearer токен включен в заголовки.
                 */
                localStorage.setItem('token', 'test-token-456');
                const mockResponse = { id: 1 };
                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse
                });

                await api.post('/quizzes', { title: 'Test' });

                expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/quizzes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer test-token-456'
                    },
                    body: JSON.stringify({ title: 'Test' })
                });
            });

            it('should throw error on POST failure', async () => {
                /**
                 * Проверка: Сбой POST-запроса с JSON ответом об ошибке.
                 * Ожидаемый результат: Выбрасывает ошибку с детальным сообщением.
                 */
                fetchMock.mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    statusText: 'Bad Request',
                    json: async () => ({ detail: 'Invalid data' })
                });

                await expect(api.post('/quizzes', {})).rejects.toThrow('Invalid data');
            });

            it('should handle POST error without JSON response', async () => {
                /**
                 * Проверка: Сбой POST-запроса, когда сервер возвращает не JSON (например, 500 html).
                 * Ожидаемый результат: Выбрасывает ошибку с текстом HTTP статуса.
                 */
                fetchMock.mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    json: async () => { throw new Error('No JSON'); }
                });

                await expect(api.post('/quizzes', {})).rejects.toThrow('HTTP 500: Internal Server Error');
            });

            it('should handle network errors in POST', async () => {
                /**
                 * Проверка: Сбой на уровне сети (например, оффлайн).
                 * Ожидаемый результат: Выбрасывает исходную ошибку сети.
                 */
                fetchMock.mockRejectedValueOnce(new Error('Network error'));

                await expect(api.post('/quizzes', {})).rejects.toThrow('Network error');
            });
        });

        describe('DELETE requests', () => {
            it('should make a DELETE request with correct headers', async () => {
                /**
                 * Проверка: Форматирование DELETE-запроса.
                 * Ожидаемый результат: Fetch вызван с методом DELETE.
                 */
                const mockResponse = { message: 'Deleted' };
                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse
                });

                const result = await api.delete('/quizzes/1');

                expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/quizzes/1', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                expect(result).toEqual(mockResponse);
            });

            it('should include auth token in DELETE request if available', async () => {
                /**
                 * Проверка: Заголовок авторизации в DELETE-запросе.
                 * Ожидаемый результат: Bearer токен включен.
                 */
                localStorage.setItem('token', 'test-token-789');
                const mockResponse = { message: 'Deleted' };
                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse
                });

                await api.delete('/quizzes/1');

                expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/quizzes/1', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer test-token-789'
                    }
                });
            });

            it('should throw error on failed DELETE request', async () => {
                /**
                 * Проверка: Сбой DELETE-запроса (например, 404).
                 * Ожидаемый результат: Выбрасывает ошибку с HTTP статусом.
                 */
                fetchMock.mockResolvedValueOnce({
                    ok: false,
                    status: 404
                });

                await expect(api.delete('/quizzes/999')).rejects.toThrow('HTTP 404');
            });
        });

        describe('Question creation specifically', () => {
            it('should successfully post a question with choices', async () => {
                /**
                 * Проверка: Сложный POST payload для создания вопроса.
                 * Ожидаемый результат: Payload соответствует структуре схемы бэкенда.
                 */
                localStorage.setItem('token', 'test-token');
                const questionData = {
                    text: 'What is 2+2?',
                    timer_seconds: 30,
                    question_type: 'single',
                    choices: [
                        { text: '4', is_correct: true },
                        { text: '5', is_correct: false },
                        { text: '3', is_correct: false }
                    ]
                };

                const mockResponse = {
                    id: 1,
                    ...questionData,
                    choices: [
                        { id: 1, text: '4', is_correct: true },
                        { id: 2, text: '5', is_correct: false },
                        { id: 3, text: '3', is_correct: false }
                    ]
                };

                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse
                });

                const result = await api.post('/quizzes/1/questions', questionData);

                expect(fetchMock).toHaveBeenCalledWith(
                    'http://localhost:8000/quizzes/1/questions',
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify(questionData)
                    })
                );
                expect(result).toEqual(mockResponse);
            });

            it('should handle missing quiz error', async () => {
                /**
                 * Проверка: Отправка данных для несуществующей викторины.
                 * Ожидаемый результат: Выбрасывает специфическое сообщение об ошибке от бэкенда.
                 */
                localStorage.setItem('token', 'test-token');
                const questionData = {
                    text: 'Test question',
                    timer_seconds: 20,
                    choices: [
                        { text: 'Yes', is_correct: true },
                        { text: 'No', is_correct: false }
                    ]
                };

                fetchMock.mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    json: async () => ({ detail: 'Quiz not found' })
                });

                await expect(api.post('/quizzes/999/questions', questionData))
                    .rejects.toThrow('Quiz not found');
            });

            it('should handle authentication errors', async () => {
                /**
                 * Проверка: Отправка данных без валидной авторизации.
                 * Ожидаемый результат: Выбрасывает ошибку Not authenticated.
                 */
                const questionData = {
                    text: 'Test',
                    timer_seconds: 20,
                    choices: [{ text: 'A', is_correct: true }]
                };

                fetchMock.mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    json: async () => ({ detail: 'Not authenticated' })
                });

                await expect(api.post('/quizzes/1/questions', questionData))
                    .rejects.toThrow('Not authenticated');
            });
        });
    });

    // --- View Tests ---
    describe('Profile View', () => {
        it('renders user info correctly', async () => {
            /**
             * Проверка: Рендеринг профиля с мок данными API.
             * Ожидаемый результат: Контейнер содержит имя пользователя, био и текст редактирования.
             */
            
            vi.spyOn(api, 'get').mockResolvedValue({
                username: 'test_user',
                bio: 'test bio',
                avatar_url: null
            });

            const container = document.createElement('div');
            await renderProfile(container);

            expect(container.innerHTML).toContain('test_user');
            expect(container.innerHTML).toContain('test bio');
            expect(container.innerHTML).toContain('Редактировать профиль');
        });
    });
});
