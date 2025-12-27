# MyQuiz

MyQuiz — это многопользовательская викторина в реальном времени. Пользователи могут создавать викторины, проводить игровые комнаты и присоединяться в качестве игроков. Ведущий управляет ходом игры (следующий вопрос, показать результаты), а игроки отвечают на своих устройствах. Очки начисляются за точность и скорость ответов.

## Технологический стек

**Backend:**
*   **Язык:** Python
*   **Фреймворк:** FastAPI
*   **База данных:** SQLite (через SQLAlchemy)
*   **Аутентификация:** JWT (JSON Web Tokens)
*   **Real-time:** WebSockets

**Frontend:**
*   **Язык:** TypeScript
*   **Сборщик:** Vite
*   **Тестирование:** Vitest

## Структура проекта

```text
/backend
  main.py           - Точка входа приложения и API маршруты
  models.py         - Модели базы данных (SQLAlchemy)
  schemas.py        - Pydantic модели для валидации данных
  crud.py           - Операции с базой данных
  auth.py           - Логика аутентификации
  database.py       - Настройка подключения к базе данных
  tests/test_all.py - Объединенные модульные и интеграционные тесты

/frontend
  src/
    views/          - UI компоненты для разных страниц (Host, Game, Profile)
    api.ts          - Обертка для API клиента
    state.ts        - Простой менеджер состояния
    main.ts         - Точка входа и маршрутизация
    tests/          - Объединенные фронтенд тесты
```

## Запуск проекта

### 1. Backend

Откройте терминал в корневой папке проекта:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

API будет доступно по адресу `http://localhost:8000`.

### 2. Frontend

Откройте второй терминал:

```bash
cd frontend
npm install
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`

## Тестирование

**Backend:**

```bash
cd backend
export PYTHONPATH=.
pytest tests/test_all.py
```

**Frontend:**

```bash
cd frontend
npm test
```
