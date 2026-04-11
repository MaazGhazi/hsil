from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "student"


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class OnboardingSurvey(BaseModel):
    year_level: str           # ms1, ms2, ms3, ms4, resident_pgy1..5, fellow, attending
    institution: str
    specialty: str | None = None
    prior_anatomy_courses: int = 0
    fluoroscopy_experience: str = "none"  # none, observed, assisted, performed


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    accuracy_score: float | None
    is_active: bool
    # Survey
    year_level: str | None
    institution: str | None
    specialty: str | None
    onboarding_complete: bool
    # Gamification
    xp_points: int
    level: int
    streak_days: int
    best_streak: int
    total_images_labeled: int
    badges: str | None

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    id: str
    full_name: str
    year_level: str | None
    institution: str | None
    xp_points: int
    level: int
    accuracy_score: float | None
    total_images_labeled: int
    streak_days: int
    best_streak: int

    model_config = {"from_attributes": True}
