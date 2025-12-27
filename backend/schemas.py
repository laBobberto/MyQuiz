from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class ChoiceBase(BaseModel):
    text: str
    is_correct: bool

class ChoiceCreate(ChoiceBase):
    pass

class ChoiceResponse(ChoiceBase):
    id: int
    class Config:
        from_attributes = True

class QuestionCreate(BaseModel):
    text: str
    timer_seconds: Optional[int] = None 
    question_type: str = "single"  
    choices: List[ChoiceCreate]

class QuestionUpdate(BaseModel):
    text: str
    timer_seconds: int = 20
    question_type: str = "single"
    choices: List[ChoiceCreate]

class QuestionResponse(BaseModel):
    id: int
    text: str
    timer_seconds: int
    question_type: str = "single"
    choices: List[ChoiceResponse]
    class Config:
        from_attributes = True

class QuizCreate(BaseModel):
    title: str
    category_id: Optional[int] = None
    description: Optional[str] = None
    default_timer_seconds: int = 20

class QuizResponse(BaseModel):
    id: int
    title: str
    creator_id: int
    description: Optional[str] = None
    default_timer_seconds: int
    questions: List[QuestionResponse] = []
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int

class RoomResponse(BaseModel):
    id: int
    code: str
    quiz_id: int
    status: str
    current_question_index: int
    class Config:
        from_attributes = True

class ParticipantResponse(BaseModel):
    id: int
    user_id: int
    score: float
    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    user_id: Optional[int] = None
    username: str
    score: float
    participant_id: Optional[int] = None

class HistoryEntry(BaseModel):
    room_code: str
    quiz_title: str
    date: datetime
    role: str 
    score: Optional[float] = None
    rank: Optional[str] = None 