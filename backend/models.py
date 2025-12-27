from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Float, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    
    quizzes = relationship("Quiz", back_populates="creator")
    participants = relationship("Participant", back_populates="user")


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    creator_id = Column(Integer, ForeignKey("users.id"))
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    description = Column(Text, nullable=True)
    default_timer_seconds = Column(Integer, default=20)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    creator = relationship("User", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete")
    rooms = relationship("Room", back_populates="quiz")


class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    timer_seconds = Column(Integer, default=20)
    question_type = Column(String, default="single")  

    quiz = relationship("Quiz", back_populates="questions")
    choices = relationship("Choice", back_populates="question", cascade="all, delete")


class Choice(Base):
    __tablename__ = "choices"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String)
    is_correct = Column(Boolean, default=False)
    question_id = Column(Integer, ForeignKey("questions.id"))

    question = relationship("Question", back_populates="choices")


class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    status = Column(String, default="waiting")  
    current_question_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    quiz = relationship("Quiz", back_populates="rooms")
    participants = relationship("Participant", back_populates="room", cascade="all, delete")


class Participant(Base):
    __tablename__ = "participants"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    score = Column(Float, default=0.0)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_approved = Column(Boolean, default=False)
    nickname = Column(String, nullable=True)
    
    user = relationship("User", back_populates="participants")
    room = relationship("Room", back_populates="participants")
    answers = relationship("Answer", back_populates="participant")


class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    choice_id = Column(Integer, ForeignKey("choices.id"))
    response_time = Column(Float)  
    is_correct = Column(Boolean, default=False)
    points = Column(Float, default=0.0)
    answered_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    participant = relationship("Participant", back_populates="answers")