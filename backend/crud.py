from sqlalchemy.orm import Session
from sqlalchemy import desc
import models, schemas

def update_user(db: Session, user_id: int, user_data: schemas.UserUpdate):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        if user_data.avatar_url is not None:
            user.avatar_url = user_data.avatar_url
        if user_data.bio is not None:
            user.bio = user_data.bio
        db.commit()
        db.refresh(user)
    return user

def get_history(db: Session, user_id: int):
    hosted_rooms = db.query(models.Room).join(models.Quiz).filter(
        models.Quiz.creator_id == user_id,
        models.Room.status == 'finished'
    ).all()

    history = []
    for room in hosted_rooms:
        history.append(schemas.HistoryEntry(
            room_code=room.code,
            quiz_title=room.quiz.title,
            date=room.created_at,
            role='host',
            score=None,
            rank=None
        ))

    participations = db.query(models.Participant).join(models.Room).filter(
        models.Participant.user_id == user_id,
        models.Room.status == 'finished',
        models.Participant.is_approved == True
    ).all()

    for p in participations:
        all_participants = db.query(models.Participant).filter(
            models.Participant.room_id == p.room_id,
            models.Participant.is_approved == True
        ).order_by(desc(models.Participant.score)).all()
        
        rank_idx = -1
        for idx, ap in enumerate(all_participants):
            if ap.id == p.id:
                rank_idx = idx + 1
                break
        
        rank_str = f"{rank_idx}/{len(all_participants)}"

        history.append(schemas.HistoryEntry(
            room_code=p.room.code,
            quiz_title=p.room.quiz.title,
            date=p.room.created_at,
            role='player',
            score=p.score,
            rank=rank_str
        ))
    
    history.sort(key=lambda x: x.date, reverse=True)
    return history

def get_categories(db: Session):
    return db.query(models.Category).all()

def create_category(db: Session, name: str):
    cat = models.Category(name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

def create_quiz(db: Session, quiz: schemas.QuizCreate, user_id: int):
    db_quiz = models.Quiz(
        title=quiz.title,
        creator_id=user_id,
        category_id=quiz.category_id,
        description=quiz.description,
        default_timer_seconds=quiz.default_timer_seconds
    )
    db.add(db_quiz)
    db.commit()
    db.refresh(db_quiz)
    return db_quiz

def get_quizzes(db: Session, user_id: int):
    return db.query(models.Quiz).filter(models.Quiz.creator_id == user_id).order_by(desc(models.Quiz.created_at)).all()

def get_quiz(db: Session, quiz_id: int):
    return db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()

def delete_quiz(db: Session, quiz_id: int):
    db_quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if db_quiz:
        db.delete(db_quiz)
        db.commit()
    return db_quiz

def update_quiz(db: Session, quiz_id: int, quiz_data: schemas.QuizCreate):
    db_quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if db_quiz:
        db_quiz.title = quiz_data.title
        db_quiz.description = quiz_data.description
        db_quiz.default_timer_seconds = quiz_data.default_timer_seconds
        db_quiz.category_id = quiz_data.category_id
        db.commit()
        db.refresh(db_quiz)
    return db_quiz

def add_question_to_quiz(db: Session, quiz_id: int, question_data: schemas.QuestionCreate):
    timer = question_data.timer_seconds
    if timer is None:
        quiz = get_quiz(db, quiz_id)
        timer = quiz.default_timer_seconds if quiz else 20

    db_question = models.Question(
        text=question_data.text,
        timer_seconds=timer,
        question_type=question_data.question_type,
        quiz_id=quiz_id
    )
    db.add(db_question)
    db.commit()
    db.refresh(db_question)

    for choice in question_data.choices:
        db_choice = models.Choice(**choice.dict(), question_id=db_question.id)
        db.add(db_choice)

    db.commit()
    db.refresh(db_question)
    return db_question

def update_question(db: Session, question_id: int, question_data: schemas.QuestionUpdate):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not db_question:
        return None
    
    db_question.text = question_data.text
    db_question.timer_seconds = question_data.timer_seconds
    db_question.question_type = question_data.question_type
    
    db.query(models.Choice).filter(models.Choice.question_id == question_id).delete()
    db.commit()
    
    for choice in question_data.choices:
        db_choice = models.Choice(**choice.dict(), question_id=db_question.id)
        db.add(db_choice)
    
    db.commit()
    db.refresh(db_question)
    return db_question

def get_questions_for_quiz(db: Session, quiz_id: int):
    return db.query(models.Question).filter(models.Question.quiz_id == quiz_id).all()

def delete_question(db: Session, question_id: int):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if db_question:
        db.delete(db_question)
        db.commit()
    return db_question

def create_room(db: Session, quiz_id: int):
    import uuid
    room_code = str(uuid.uuid4())[:6].upper()
    new_room = models.Room(code=room_code, quiz_id=quiz_id, status="waiting")
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return new_room

def get_room(db: Session, room_code: str):
    return db.query(models.Room).filter(models.Room.code == room_code).first()

def update_room_status(db: Session, room_code: str, status: str):
    room = db.query(models.Room).filter(models.Room.code == room_code).first()
    if room:
        room.status = status
        db.commit()
        db.refresh(room)
    return room

def add_participant(db: Session, room_id: int, user_id: int = None, is_approved: bool = False, nickname: str = None):
    participant = models.Participant(room_id=room_id, user_id=user_id, is_approved=is_approved, nickname=nickname)
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant

def update_participant_approval(db: Session, participant_id: int, is_approved: bool):
    participant = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if participant:
        participant.is_approved = is_approved
        db.commit()
        db.refresh(participant)
    return participant

def get_participants(db: Session, room_id: int):
    return db.query(models.Participant).filter(models.Participant.room_id == room_id).all()

def get_leaderboard(db: Session, room_id: int):
    participants = db.query(models.Participant).filter(
        models.Participant.room_id == room_id,
        models.Participant.is_approved == True
    ).order_by(desc(models.Participant.score)).all()
    
    result = []
    for p in participants:
        username = p.nickname  
        if not username and p.user_id:
            user = db.query(models.User).filter(models.User.id == p.user_id).first()
            username = user.username if user else f"Player {p.id}"
        else:
            username = username or f"Player {p.id}"
        
        result.append(schemas.LeaderboardEntry(
            user_id=p.user_id,
            username=username,
            score=p.score,
            participant_id=p.id
        ))
    return result

def process_answer(db: Session, participant_id: int, question_id: int, choice_id: int, response_time: float):
    choice = db.query(models.Choice).filter(models.Choice.id == choice_id).first()
    question = db.query(models.Question).filter(models.Question.id == question_id).first()

    if not choice or not question:
        return 0

    is_correct = choice.is_correct
    score_earned = 0
    timer = question.timer_seconds
    
    if is_correct:
        max_points = 1000
        
        earlier_answers = db.query(models.Answer).filter(
            models.Answer.question_id == question_id,
            models.Answer.is_correct == True
        ).all()
        
        answer_order = len(earlier_answers) + 1  
        
        order_multipliers = {1: 1.0, 2: 0.8, 3: 0.6}
        order_factor = order_multipliers.get(answer_order, 0.4)
        
        
        
        
        effective_time = min(response_time, timer)
        time_factor = 1 - (effective_time / timer / 2)
        
        score_earned = round(max_points * order_factor * time_factor)

    
    if response_time > timer + 2.0:
        score_earned = 0

    new_answer = models.Answer(
        participant_id=participant_id,
        question_id=question_id,
        choice_id=choice_id,
        response_time=response_time,
        is_correct=is_correct,
        points=score_earned
    )
    db.add(new_answer)

    participant = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if participant:
        participant.score += score_earned

    db.commit()
    return score_earned

def reset_room_scores(db: Session, room_id: int):
    participants = db.query(models.Participant).filter(models.Participant.room_id == room_id).all()
    for p in participants:
        p.score = 0.0
    
    participant_ids = [p.id for p in participants]
    if participant_ids:
        db.query(models.Answer).filter(models.Answer.participant_id.in_(participant_ids)).delete(synchronize_session=False)
    
    db.commit()