import uuid
import os
from typing import Dict, List
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models, schemas, auth, database, crud

app = FastAPI(title="MyQuiz Clone API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)

@app.on_event("startup")
def seed_categories():
    db = database.SessionLocal()
    if db.query(models.Category).count() == 0:
        cats = ["Общие знания", "Наука", "История", "Кино", "Музыка", "Спорт", "Игры"]
        for c in cats:
            db.add(models.Category(name=c))
        db.commit()
    db.close()



@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_pwd = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.Token)
def login(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    if not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = auth.create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer", "user_id": db_user.id}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me", response_model=schemas.UserResponse)
def update_user_me(user_data: schemas.UserUpdate, 
                   db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    return crud.update_user(db, current_user.id, user_data)

@app.get("/users/me/history", response_model=List[schemas.HistoryEntry])
def read_history_me(db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_history(db, current_user.id)

@app.post("/reset-password")
def reset_password(data: schemas.UserCreate, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = auth.get_password_hash(data.password)
    db.commit()
    return {"message": "Password updated successfully"}

@app.get("/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(database.get_db)):
    return crud.get_categories(db)


@app.post("/quizzes", response_model=schemas.QuizResponse)
def create_quiz(quiz: schemas.QuizCreate, db: Session = Depends(database.get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_quiz(db=db, quiz=quiz, user_id=current_user.id)


@app.get("/quizzes", response_model=List[schemas.QuizResponse])
def list_quizzes(db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_quizzes(db, user_id=current_user.id)


@app.get("/quizzes/{quiz_id}", response_model=schemas.QuizResponse)
def get_quiz(quiz_id: int, db: Session = Depends(database.get_db),
             current_user: models.User = Depends(auth.get_current_user)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@app.delete("/quizzes/{quiz_id}")
def delete_quiz(quiz_id: int, db: Session = Depends(database.get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this quiz")
    
    crud.delete_quiz(db, quiz_id)
    return {"message": "Quiz deleted successfully"}


@app.put("/quizzes/{quiz_id}", response_model=schemas.QuizResponse)
def update_quiz(quiz_id: int, quiz: schemas.QuizCreate, db: Session = Depends(database.get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    db_quiz = crud.get_quiz(db, quiz_id)
    if not db_quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if db_quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this quiz")
    
    return crud.update_quiz(db, quiz_id, quiz)


@app.post("/quizzes/{quiz_id}/questions", response_model=schemas.QuestionResponse)
def add_question(quiz_id: int, q: schemas.QuestionCreate, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this quiz")
    
    return crud.add_question_to_quiz(db, quiz_id, q)


@app.get("/quizzes/{quiz_id}/questions", response_model=List[schemas.QuestionResponse])
def get_questions(quiz_id: int, db: Session = Depends(database.get_db)):
    return crud.get_questions_for_quiz(db, quiz_id)


@app.put("/questions/{question_id}", response_model=schemas.QuestionResponse)
def update_question(question_id: int, q: schemas.QuestionUpdate, db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    quiz = question.quiz
    if quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this question")
    
    return crud.update_question(db, question_id, q)


@app.delete("/questions/{question_id}")
def delete_question(question_id: int, db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    quiz = question.quiz
    if quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this question")
    
    crud.delete_question(db, question_id)
    return {"message": "Question deleted successfully"}



@app.post("/rooms/create/{quiz_id}", response_model=schemas.RoomResponse)
def create_room(quiz_id: int, db: Session = Depends(database.get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    quiz = crud.get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to create room for this quiz")
    
    room = crud.create_room(db, quiz_id)
    return room


@app.get("/rooms/{room_code}")
def get_room_info(room_code: str, db: Session = Depends(database.get_db)):
    room = crud.get_room(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    approved_count = sum(1 for p in room.participants if p.is_approved)
    
    return {
        "room_code": room.code,
        "quiz_id": room.quiz_id,
        "status": room.status,
        "participants_count": approved_count
    }


@app.get("/rooms/{room_code}/leaderboard")
def get_leaderboard(room_code: str, db: Session = Depends(database.get_db)):
    room = crud.get_room(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {"leaderboard": crud.get_leaderboard(db, room.id)}


@app.get("/rooms/{room_code}/host-quizzes", response_model=List[schemas.QuizResponse])
def get_host_quizzes(room_code: str, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    room = crud.get_room(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    quiz = room.quiz
    if quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return crud.get_quizzes(db, user_id=current_user.id)



class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.room_hosts: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, room_code: str, is_host: bool):
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        
        if is_host:
            self.room_hosts[room_code] = websocket
        else:
            self.active_connections[room_code].append(websocket)

    def disconnect(self, websocket: WebSocket, room_code: str, is_host: bool):
        if is_host:
            if room_code in self.room_hosts:
                del self.room_hosts[room_code]
        else:
            if room_code in self.active_connections:
                try:
                    self.active_connections[room_code].remove(websocket)
                except ValueError:
                    pass

    async def broadcast(self, room_code: str, message: dict, exclude_host: bool = False):
        if room_code in self.active_connections:
            for connection in self.active_connections[room_code]:
                try:
                    await connection.send_json(message)
                except:
                    pass
        
        if not exclude_host and room_code in self.room_hosts:
            try:
                await self.room_hosts[room_code].send_json(message)
            except:
                pass

    async def send_to_host(self, room_code: str, message: dict):
        if room_code in self.room_hosts:
            try:
                await self.room_hosts[room_code].send_json(message)
            except:
                pass


manager = ConnectionManager()


@app.websocket("/ws/{room_code}/{role}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, role: str):
    is_host = (role == "host")
    await manager.connect(websocket, room_code, is_host)
    
    db: Session = database.SessionLocal()
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if is_host:
                if action == "approve_player":
                    participant_id = data.get("participant_id")
                    crud.update_participant_approval(db, participant_id, True)
                    
                    await manager.broadcast(room_code, {
                        "event": "player_approved",
                        "participant_id": participant_id
                    })
                    
                    room = crud.get_room(db, room_code)
                    if room:
                        approved_count = sum(1 for p in room.participants if p.is_approved)
                        await manager.broadcast(room_code, {
                            "event": "participants_update",
                            "count": approved_count
                        })

                elif action == "reject_player":
                    participant_id = data.get("participant_id")
                    await manager.broadcast(room_code, {
                        "event": "player_rejected",
                        "participant_id": participant_id
                    })

                elif action == "start_quiz":
                    room = crud.get_room(db, room_code)
                    if room:
                        crud.reset_room_scores(db, room.id)
                        crud.update_room_status(db, room_code, "active")
                        quiz = room.quiz
                        if quiz.questions:
                            current_question = quiz.questions[0]
                            await manager.broadcast(room_code, {
                                "event": "quiz_started",
                                "question": {
                                    "id": current_question.id,
                                    "text": current_question.text,
                                    "timer_seconds": current_question.timer_seconds,
                                    "choices": [
                                        {"id": c.id, "text": c.text}
                                        for c in current_question.choices
                                    ]
                                }
                            })
                
                elif action == "next_question":
                    room = crud.get_room(db, room_code)
                    if room:
                        quiz = room.quiz
                        current_idx = room.current_question_index
                        
                        leaderboard = crud.get_leaderboard(db, room.id)
                        await manager.broadcast(room_code, {
                            "event": "show_results",
                            "leaderboard": [l.dict() for l in leaderboard]
                        })
                        
                        if current_idx + 1 < len(quiz.questions):
                            room.current_question_index = current_idx + 1
                            db.commit()
                            next_question = quiz.questions[current_idx + 1]
                            await manager.broadcast(room_code, {
                                "event": "next_question",
                                "question": {
                                    "id": next_question.id,
                                    "text": next_question.text,
                                    "timer_seconds": next_question.timer_seconds,
                                    "choices": [
                                        {"id": c.id, "text": c.text}
                                        for c in next_question.choices
                                    ]
                                }
                            })
                        else:
                            await manager.broadcast(room_code, {"event": "quiz_finished"})
                
                elif action == "pause_quiz":
                    room = crud.get_room(db, room_code)
                    if room:
                        crud.update_room_status(db, room_code, "paused")
                        await manager.broadcast(room_code, {
                            "event": "quiz_paused",
                            "message": "Викторина на паузе"
                        })
                
                elif action == "resume_quiz":
                    room = crud.get_room(db, room_code)
                    if room:
                        crud.update_room_status(db, room_code, "active")
                        await manager.broadcast(room_code, {
                            "event": "quiz_resumed",
                            "message": "Викторина продолжается"
                        })
                
                elif action == "finish_quiz":
                    room = crud.get_room(db, room_code)
                    if room:
                        crud.update_room_status(db, room_code, "waiting_for_next")
                        leaderboard = crud.get_leaderboard(db, room.id)
                        await manager.broadcast(room_code, {
                            "event": "quiz_finished",
                            "leaderboard": [l.dict() for l in leaderboard]
                        })
                
                elif action == "change_quiz":
                    new_quiz_id = data.get("quiz_id")
                    room = crud.get_room(db, room_code)
                    if room:
                        quiz = crud.get_quiz(db, new_quiz_id)
                        if quiz:
                            room.quiz_id = new_quiz_id
                            room.current_question_index = 0
                            room.status = "waiting"
                            crud.reset_room_scores(db, room.id)
                            db.commit()
                            await manager.broadcast(room_code, {
                                "event": "quiz_changed",
                                "quiz_id": new_quiz_id,
                                "quiz_title": quiz.title
                            })
                
                elif action == "show_leaderboard":
                    room = crud.get_room(db, room_code)
                    if room:
                        leaderboard = crud.get_leaderboard(db, room.id)
                        await manager.broadcast(room_code, {
                            "event": "leaderboard",
                            "leaderboard": [l.dict() for l in leaderboard]
                        })
            
            else:  
                if action == "join_room":
                    room = crud.get_room(db, room_code)
                    if room:
                        user_id = data.get("user_id")
                        nickname = data.get("nickname")
                        participant = crud.add_participant(db, room.id, user_id, is_approved=False, nickname=nickname)
                        
                        if nickname:
                            display_name = nickname
                        else:
                            user = db.query(models.User).filter(models.User.id == user_id).first() if user_id else None
                            display_name = user.username if user else f"Player {user_id}"

                        await manager.send_to_host(room_code, {
                            "event": "player_request",
                            "participant": {
                                "id": participant.id,
                                "username": display_name,
                                "user_id": user_id
                            }
                        })
                        
                        await websocket.send_json({
                            "event": "waiting_approval",
                            "participant_id": participant.id
                        })
                
                elif action == "submit_answer":
                    participant_id = data.get("participant_id")
                    question_id = data.get("question_id")
                    choice_id = data.get("choice_id")
                    response_time = data.get("response_time", 0)
                    
                    score = crud.process_answer(
                        db,
                        participant_id=participant_id,
                        question_id=question_id,
                        choice_id=choice_id,
                        response_time=response_time
                    )
                    
                    choice = db.query(models.Choice).filter(models.Choice.id == choice_id).first()
                    
                    await websocket.send_json({
                        "event": "answer_result",
                        "score_earned": score,
                        "is_correct": choice.is_correct if choice else False
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_code, is_host)
        if is_host:
            await manager.broadcast(room_code, {"event": "host_disconnected"})
        else:
            room = crud.get_room(db, room_code)
            if room:
                await manager.send_to_host(room_code, {
                    "event": "player_left",
                    "participants_count": len(room.participants) - 1
                })
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok"}
