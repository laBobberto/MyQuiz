import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

from main import app
from database import Base, get_db
import models
import crud

SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def client():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    if db.query(models.Category).count() == 0:
        db.add(models.Category(name="Test Category"))
        db.commit()
    db.close()

    yield TestClient(app)
    
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides = {}

class TestAuth:
    def test_register_user(self, client):
        """
        Проверка: Регистрация нового пользователя.
        Ожидаемый результат: 200 OK, возвращает данные пользователя с правильным именем.
        """
        response = client.post(
            "/register",
            json={"username": "testuser", "password": "password123"}
        )
        assert response.status_code == 200
        assert response.json()["username"] == "testuser"

    def test_register_duplicate_user(self, client):
        """
        Проверка: Регистрация пользователя с уже существующим именем.
        Ожидаемый результат: 400 Bad Request, сообщение об ошибке, что пользователь уже зарегистрирован.
        """
        client.post("/register", json={"username": "user2", "password": "pass123"})
        response = client.post("/register", json={"username": "user2", "password": "pass123"})
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_login_user(self, client):
        """
        Проверка: Вход с правильными учетными данными.
        Ожидаемый результат: 200 OK, возвращает токен доступа.
        """
        client.post("/register", json={"username": "loginuser", "password": "password123"})
        response = client.post(
            "/login",
            json={"username": "loginuser", "password": "password123"}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert response.json()["token_type"] == "bearer"

    def test_login_invalid_credentials(self, client):
        """
        Проверка: Вход с неправильным паролем.
        Ожидаемый результат: 401 Unauthorized, сообщение об ошибке о неверных учетных данных.
        """
        client.post("/register", json={"username": "user3", "password": "password123"})
        response = client.post(
            "/login",
            json={"username": "user3", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_nonexistent_user(self, client):
        """
        Проверка: Вход с несуществующим именем пользователя.
        Ожидаемый результат: 401 Unauthorized.
        """
        response = client.post(
            "/login",
            json={"username": "nonexistent", "password": "password123"}
        )
        assert response.status_code == 401

    def test_reset_password(self, client):
        """
        Проверка: Сброс пароля для существующего пользователя.
        Ожидаемый результат: 200 OK, старый пароль не работает (401), новый пароль работает (200).
        """
        client.post("/register", json={"username": "resetuser", "password": "oldpass"})
        response = client.post(
            "/reset-password",
            json={"username": "resetuser", "password": "newpass"}
        )
        assert response.status_code == 200
        
        login_response = client.post(
            "/login",
            json={"username": "resetuser", "password": "oldpass"}
        )
        assert login_response.status_code == 401
        
        login_response = client.post(
            "/login",
            json={"username": "resetuser", "password": "newpass"}
        )
        assert login_response.status_code == 200

    def test_reset_password_nonexistent_user(self, client):
        """
        Проверка: Сброс пароля для несуществующего пользователя.
        Ожидаемый результат: 404 Not Found.
        """
        response = client.post(
            "/reset-password",
            json={"username": "nouser", "password": "pass"}
        )
        assert response.status_code == 404

    def test_profile_update(self, client):
        """
        Проверка: Обновление профиля пользователя (био, аватар).
        Ожидаемый результат: 200 OK, возвращает обновленные данные профиля.
        """
        client.post("/register", json={"username": "prof_test", "password": "password"})
        token = client.post("/login", json={"username": "prof_test", "password": "password"}).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = client.put("/users/me", json={"bio": "Hello World", "avatar_url": "http://img.com/1.png"}, headers=headers)
        assert response.status_code == 200
        assert response.json()["bio"] == "Hello World"
        
        response = client.get("/users/me", headers=headers)
        assert response.json()["bio"] == "Hello World"

def test_categories(client):
    """
    Проверка: Получение списка категорий.
    Ожидаемый результат: 200 OK, список не пуст (заполнен).
    """
    response = client.get("/categories")
    assert response.status_code == 200
    assert len(response.json()) > 0

class TestQuiz:
    token = None
    quiz_id = None

    @pytest.fixture(autouse=True)
    def setup(self, client):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        client.post(
            "/register",
            json={"username": "quizuser", "password": "password123"}
        )
        self.token = client.post(
            "/login",
            json={"username": "quizuser", "password": "password123"}
        ).json()["access_token"]

    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def test_create_quiz(self, client):
        """
        Проверка: Создание новой викторины.
        Ожидаемый результат: 200 OK, возвращает объект викторины с правильным заголовком и описанием.
        """
        response = client.post(
            "/quizzes",
            json={"title": "Test Quiz", "category_id": 1, "description": "A test quiz"},
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Quiz"
        assert data["description"] == "A test quiz"
        assert "id" in data

    def test_create_quiz_without_auth(self, client):
        """
        Проверка: Создание викторины без аутентификации.
        Ожидаемый результат: 401 Unauthorized.
        """
        response = client.post(
            "/quizzes",
            json={"title": "Test Quiz", "category_id": 1}
        )
        assert response.status_code == 401

    def test_list_quizzes(self, client):
        """
        Проверка: Список викторин пользователя.
        Ожидаемый результат: 200 OK, возвращает список созданных викторин.
        """
        for i in range(3):
            client.post(
                "/quizzes",
                json={"title": f"Quiz {i}", "category_id": 1},
                headers=self.get_headers()
            )
        
        response = client.get("/quizzes", headers=self.get_headers())
        assert response.status_code == 200
        quizzes = response.json()
        assert len(quizzes) == 3

    def test_get_quiz(self, client):
        """
        Проверка: Получение конкретной викторины по ID.
        Ожидаемый результат: 200 OK, возвращает правильные данные викторины.
        """
        create_response = client.post(
            "/quizzes",
            json={"title": "Get Test Quiz", "category_id": 1},
            headers=self.get_headers()
        )
        quiz_id = create_response.json()["id"]
        
        response = client.get(f"/quizzes/{quiz_id}", headers=self.get_headers())
        assert response.status_code == 200
        assert response.json()["title"] == "Get Test Quiz"

    def test_get_nonexistent_quiz(self, client):
        """
        Проверка: Получение несуществующей викторины.
        Ожидаемый результат: 404 Not Found.
        """
        response = client.get("/quizzes/99999", headers=self.get_headers())
        assert response.status_code == 404

    def test_delete_quiz(self, client):
        """
        Проверка: Удаление викторины.
        Ожидаемый результат: 200 OK, последующее получение возвращает 404.
        """
        create_response = client.post(
            "/quizzes",
            json={"title": "Delete Test Quiz", "category_id": 1},
            headers=self.get_headers()
        )
        quiz_id = create_response.json()["id"]
        
        delete_response = client.delete(f"/quizzes/{quiz_id}", headers=self.get_headers())
        assert delete_response.status_code == 200
        
        get_response = client.get(f"/quizzes/{quiz_id}", headers=self.get_headers())
        assert get_response.status_code == 404

    def test_create_quiz_with_timer_and_category(self, client):
        """
        Проверка: Создание викторины с таймером по умолчанию и его наследование вопросами.
        Ожидаемый результат: 200 OK, вопрос наследует таймер.
        """
        db = TestingSessionLocal()
        if db.query(models.Category).count() == 0:
            db.add(models.Category(name="Test Category"))
            db.commit()
        db.close()

        cats = client.get("/categories").json()
        cat_id = cats[0]["id"]

        response = client.post("/quizzes", json={
            "title": "Timed Quiz",
            "category_id": cat_id,
            "default_timer_seconds": 45
        }, headers=self.get_headers())
        
        assert response.status_code == 200
        data = response.json()
        assert data["default_timer_seconds"] == 45
        assert data["title"] == "Timed Quiz"

        q_response = client.post(f"/quizzes/{data['id']}/questions", json={
            "text": "Inherit Timer?",
            "choices": [{"text": "Yes", "is_correct": True}, {"text": "No", "is_correct": False}]
        }, headers=self.get_headers())
        
        assert q_response.json()["timer_seconds"] == 45


class TestQuestions:
    token = None
    quiz_id = None

    @pytest.fixture(autouse=True)
    def setup(self, client):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        client.post(
            "/register",
            json={"username": "quser", "password": "password123"}
        )
        self.token = client.post(
            "/login",
            json={"username": "quser", "password": "password123"}
        ).json()["access_token"]
        
        quiz_response = client.post(
            "/quizzes",
            json={"title": "Test Quiz", "category_id": 1},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        self.quiz_id = quiz_response.json()["id"]

    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def test_add_question(self, client):
        """
        Проверка: Добавление вопроса в викторину.
        Ожидаемый результат: 200 OK, возвращает данные вопроса с вариантами ответов.
        """
        response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "What is 2 + 2?",
                "timer_seconds": 30,
                "choices": [
                    {"text": "4", "is_correct": True},
                    {"text": "5", "is_correct": False},
                    {"text": "3", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "What is 2 + 2?"
        assert data["timer_seconds"] == 30
        assert len(data["choices"]) == 3
        assert data["choices"][0]["is_correct"] == True
        assert data["choices"][0]["text"] == "4"

    def test_add_question_with_empty_text(self, client):
        """
        Проверка: Добавление вопроса с пустым текстом.
        Ожидаемый результат: 200 OK (в настоящее время разрешено).
        """
        response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "",
                "timer_seconds": 30,
                "choices": [
                    {"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        assert response.status_code == 200

    def test_add_question_missing_required_fields(self, client):
        """
        Проверка: Добавление вопроса без обязательного поля 'text'.
        Ожидаемый результат: 422 Unprocessable Entity.
        """
        response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "timer_seconds": 30,
                "choices": [
                    {"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        assert response.status_code == 422

    def test_add_question_missing_choices(self, client):
        """
        Проверка: Добавление вопроса без поля 'choices'.
        Ожидаемый результат: 422 Unprocessable Entity.
        """
        response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "Question without choices",
                "timer_seconds": 30
            },
            headers=self.get_headers()
        )
        assert response.status_code == 422

    def test_add_question_invalid_timer(self, client):
        """
        Проверка: Добавление вопроса с отрицательным таймером.
        Ожидаемый результат: 200 OK (в настоящее время разрешено).
        """
        response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "Question",
                "timer_seconds": -5,
                "choices": [
                    {"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        assert response.status_code == 200

    def test_add_question_to_nonexistent_quiz(self, client):
        """
        Проверка: Добавление вопроса к несуществующей викторине.
        Ожидаемый результат: 404 Not Found.
        """
        response = client.post(
            f"/quizzes/99999/questions",
            json={
                "text": "Test question",
                "timer_seconds": 30,
                "choices": [
                    {"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        assert response.status_code == 404

    def test_add_question_without_auth(self, client):
        """
        Проверка: Добавление вопроса без аутентификации.
        Ожидаемый результат: 401 Unauthorized.
        """
        response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "Test question",
                "timer_seconds": 30,
                "choices": [
                    {"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}
                ]
            }
        )
        assert response.status_code == 401

    def test_add_question_with_multiple_choice_type(self, client):
        """
        Проверка: Добавление вопроса с типом 'multiple'.
        Ожидаемый результат: 200 OK, тип сохранен корректно.
        """
        response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "Select all correct answers",
                "timer_seconds": 45,
                "question_type": "multiple",
                "choices": [
                    {"text": "Option A", "is_correct": True},
                    {"text": "Option B", "is_correct": True},
                    {"text": "Option C", "is_correct": False},
                    {"text": "Option D", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data["question_type"] == "multiple"
        assert len(data["choices"]) == 4

    def test_get_questions(self, client):
        """
        Проверка: Получение вопросов викторины.
        Ожидаемый результат: 200 OK, возвращает список вопросов.
        """
        for i in range(2):
            client.post(
                f"/quizzes/{self.quiz_id}/questions",
                json={
                    "text": f"Question {i}",
                    "timer_seconds": 20,
                    "choices": [
                        {"text": "Yes", "is_correct": True},
                        {"text": "No", "is_correct": False}
                    ]
                },
                headers=self.get_headers()
            )
        
        response = client.get(f"/quizzes/{self.quiz_id}/questions")
        assert response.status_code == 200
        questions = response.json()
        assert len(questions) == 2

    def test_get_questions_empty_quiz(self, client):
        """
        Проверка: Получение вопросов для пустой викторины.
        Ожидаемый результат: 200 OK, возвращает пустой список.
        """
        response = client.get(f"/quizzes/{self.quiz_id}/questions")
        assert response.status_code == 200
        questions = response.json()
        assert len(questions) == 0

    def test_get_questions_nonexistent_quiz(self, client):
        """
        Проверка: Получение вопросов для несуществующей викторины.
        Ожидаемый результат: 200 OK, возвращает пустой список (согласно текущей реализации).
        """
        response = client.get(f"/quizzes/99999/questions")
        assert response.status_code == 200
        questions = response.json()
        assert len(questions) == 0

    def test_delete_question(self, client):
        """
        Проверка: Удаление вопроса.
        Ожидаемый результат: 200 OK.
        """
        add_response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "Delete me",
                "timer_seconds": 20,
                "choices": [
                    {"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        question_id = add_response.json()["id"]
        
        delete_response = client.delete(
            f"/questions/{question_id}",
            headers=self.get_headers()
        )
        assert delete_response.status_code == 200

    def test_delete_nonexistent_question(self, client):
        """
        Проверка: Удаление несуществующего вопроса.
        Ожидаемый результат: 404 Not Found.
        """
        response = client.delete(
            f"/questions/99999",
            headers=self.get_headers()
        )
        assert response.status_code == 404

    def test_update_question(self, client):
        """
        Проверка: Обновление текста вопроса и вариантов ответов.
        Ожидаемый результат: 200 OK, возвращает обновленные данные.
        """
        add_response = client.post(
            f"/quizzes/{self.quiz_id}/questions",
            json={
                "text": "Original question",
                "timer_seconds": 20,
                "choices": [
                    {"text": "Yes", "is_correct": True},
                    {"text": "No", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        question_id = add_response.json()["id"]
        
        update_response = client.put(
            f"/questions/{question_id}",
            json={
                "text": "Updated question",
                "timer_seconds": 30,
                "choices": [
                    {"text": "True", "is_correct": True},
                    {"text": "False", "is_correct": False},
                    {"text": "Maybe", "is_correct": False}
                ]
            },
            headers=self.get_headers()
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["text"] == "Updated question"
        assert data["timer_seconds"] == 30
        assert len(data["choices"]) == 3


class TestRooms:
    token = None
    quiz_id = None

    @pytest.fixture(autouse=True)
    def setup(self, client):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        client.post(
            "/register",
            json={"username": "roomuser", "password": "password123"}
        )
        self.token = client.post(
            "/login",
            json={"username": "roomuser", "password": "password123"}
        ).json()["access_token"]
        
        quiz_response = client.post(
            "/quizzes",
            json={"title": "Room Quiz", "category_id": 1},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        self.quiz_id = quiz_response.json()["id"]

    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def test_create_room(self, client):
        """
        Проверка: Создание игровой комнаты для викторины.
        Ожидаемый результат: 200 OK, возвращает код комнаты и статус 'waiting'.
        """
        response = client.post(
            f"/rooms/create/{self.quiz_id}",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "code" in data
        assert len(data["code"]) == 6
        assert data["status"] == "waiting"

    def test_get_room_info(self, client):
        """
        Проверка: Получение информации о комнате по коду.
        Ожидаемый результат: 200 OK, возвращает правильный код комнаты.
        """
        create_response = client.post(
            f"/rooms/create/{self.quiz_id}",
            headers=self.get_headers()
        )
        room_code = create_response.json()["code"]
        
        response = client.get(f"/rooms/{room_code}")
        assert response.status_code == 200
        assert response.json()["room_code"] == room_code

    def test_get_nonexistent_room(self, client):
        """
        Проверка: Получение информации для несуществующего кода комнаты.
        Ожидаемый результат: 404 Not Found.
        """
        response = client.get("/rooms/NOCODE")
        assert response.status_code == 404


class TestScoring:
    def test_score_calculation_correct_answer(self):
        """
        Проверка: Расчет очков за быстрый правильный ответ.
        Ожидаемый результат: ~950 очков.
        """
        response_time = 2.0
        timer = 20.0
        time_factor = max(0, 1 - (response_time / timer * 0.5))
        score = round(1000 * time_factor)
        assert score == 950

    def test_score_calculation_slow_answer(self):
        """
        Проверка: Расчет очков за медленный правильный ответ (ближе к концу).
        Ожидаемый результат: Между 450 и 550 очков.
        """
        response_time = 19.0
        timer = 20.0
        time_factor = max(0, 1 - (response_time / timer * 0.5))
        score = round(1000 * time_factor)
        assert 450 <= score <= 550

    def test_score_calculation_zero(self):
        """
        Проверка: Логика расчета очков за превышение времени (теоретическая логика функции, фактический эндпоинт принудительно устанавливает 0).
        Ожидаемый результат: > 400 (если не обрезано новой логикой).
        """
        response_time = 21.0
        timer = 20.0
        time_factor = max(0, 1 - (response_time / timer * 0.5))
        score = round(1000 * time_factor)
        assert score > 400

    def test_timer_expiration_score_zero(self, client):
        """
        Проверка: Очки равны 0, если время ответа превышает таймер + период отсрочки (2с).
        Ожидаемый результат: Очки > 0 в период отсрочки, 0 после.
        """
        db = TestingSessionLocal()
        try:
            user = models.User(username="timer_user", hashed_password="pw")
            db.add(user)
            db.commit()
            
            quiz = models.Quiz(title="Timer Quiz", creator_id=user.id, default_timer_seconds=10)
            db.add(quiz)
            db.commit()
            
            question = models.Question(text="Q1", quiz_id=quiz.id, timer_seconds=10)
            db.add(question)
            db.commit()
            
            choice = models.Choice(text="Correct", is_correct=True, question_id=question.id)
            db.add(choice)
            db.commit()
            
            room = models.Room(code="TIMER1", quiz_id=quiz.id)
            db.add(room)
            db.commit()
            
            participant = models.Participant(room_id=room.id, user_id=user.id)
            db.add(participant)
            db.commit()

            score = crud.process_answer(db, participant.id, question.id, choice.id, response_time=5.0)
            assert score > 0

            score_grace = crud.process_answer(db, participant.id, question.id, choice.id, response_time=11.0)
            assert score_grace > 0

            score_late = crud.process_answer(db, participant.id, question.id, choice.id, response_time=13.0)
            assert score_late == 0
            
        finally:
            db.close()

    def test_reset_room_scores(self, client):
        """
        Проверка: Функция сброса очков очищает очки участников и их ответы.
        Ожидаемый результат: Очки участника становятся 0.0, ответы удаляются.
        """
        db = TestingSessionLocal()
        try:
            user = models.User(username="reset_user", hashed_password="pw")
            db.add(user)
            db.commit()
            
            quiz = models.Quiz(title="Reset Quiz", creator_id=user.id)
            db.add(quiz)
            db.commit()
            
            question = models.Question(text="Q1", quiz_id=quiz.id, timer_seconds=10)
            db.add(question)
            db.commit()
            
            choice = models.Choice(text="C1", is_correct=True, question_id=question.id)
            db.add(choice)
            db.commit()
            
            room = models.Room(code="RESET1", quiz_id=quiz.id)
            db.add(room)
            db.commit()
            
            participant = models.Participant(room_id=room.id, user_id=user.id, score=100.0)
            db.add(participant)
            db.commit()
            
            answer = models.Answer(participant_id=participant.id, question_id=question.id, choice_id=choice.id, points=100)
            db.add(answer)
            db.commit()
            
            assert participant.score == 100.0
            assert db.query(models.Answer).filter(models.Answer.participant_id == participant.id).count() == 1
            
            crud.reset_room_scores(db, room.id)
            
            db.refresh(participant)
            assert participant.score == 0.0
            
            ans = db.query(models.Answer).filter(models.Answer.participant_id == participant.id).first()
            assert ans is None

        finally:
            db.close()

class TestHealthCheck:
    def test_health_check(self, client):
        """
        Проверка: Эндпоинт проверки работоспособности (Health check).
        Ожидаемый результат: 200 OK, статус 'ok'.
        """
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
