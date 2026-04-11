import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Float, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="student")

    # --- Survey / profile fields ---
    year_level: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ms1, ms2, ms3, ms4, resident_pgy1-5, fellow, attending
    institution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    specialty: Mapped[str | None] = mapped_column(String(100), nullable=True)  # orthopedics, radiology, neurosurgery, etc.
    prior_anatomy_courses: Mapped[int | None] = mapped_column(Integer, nullable=True)  # how many anatomy courses taken
    fluoroscopy_experience: Mapped[str | None] = mapped_column(String(50), nullable=True)  # none, observed, assisted, performed
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- Gamification ---
    xp_points: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_labeled_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    total_images_labeled: Mapped[int] = mapped_column(Integer, default=0)
    badges: Mapped[str | None] = mapped_column(String(500), nullable=True)  # comma-separated badge IDs

    # --- Scoring ---
    accuracy_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
