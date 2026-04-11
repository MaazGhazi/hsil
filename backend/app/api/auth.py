from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse, OnboardingSurvey
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str, role: str, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, settings.secret_key, algorithm=settings.algorithm)


# --- XP / Level helpers ---

XP_PER_IMAGE = 10
XP_STREAK_BONUS = 5  # extra per image when on a streak
LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000]


def level_for_xp(xp: int) -> int:
    for i in range(len(LEVEL_THRESHOLDS) - 1, -1, -1):
        if xp >= LEVEL_THRESHOLDS[i]:
            return i + 1
    return 1


def xp_for_next_level(level: int) -> int:
    idx = min(level, len(LEVEL_THRESHOLDS) - 1)
    return LEVEL_THRESHOLDS[idx]


def award_xp(user: User, images_labeled: int = 1) -> dict:
    """Award XP, update streak, return what changed."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    changes = {}

    # Streak logic
    if user.last_labeled_date == today:
        # Already labeled today, no streak change
        pass
    elif user.last_labeled_date:
        from datetime import date as dt_date
        last = dt_date.fromisoformat(user.last_labeled_date)
        current = dt_date.fromisoformat(today)
        diff = (current - last).days
        if diff == 1:
            user.streak_days += 1
            changes["streak_extended"] = True
        elif diff > 1:
            user.streak_days = 1
            changes["streak_reset"] = True
    else:
        user.streak_days = 1

    if user.streak_days > user.best_streak:
        user.best_streak = user.streak_days

    user.last_labeled_date = today

    # XP
    streak_bonus = XP_STREAK_BONUS if user.streak_days > 1 else 0
    xp_earned = (XP_PER_IMAGE + streak_bonus) * images_labeled
    user.xp_points += xp_earned
    user.total_images_labeled += images_labeled

    # Level up check
    old_level = user.level
    user.level = level_for_xp(user.xp_points)
    if user.level > old_level:
        changes["level_up"] = user.level

    changes["xp_earned"] = xp_earned
    changes["total_xp"] = user.xp_points
    changes["streak"] = user.streak_days
    return changes


# --- Routes ---

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if req.role not in ("student", "expert", "surgeon", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
    )
    db.add(user)
    await db.flush()

    db.add(AuditLog(user_id=user.id, action="user.registered", entity_type="user", entity_id=user.id))
    return user


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    access_token = create_token(user.id, user.role, timedelta(minutes=settings.access_token_expire_minutes))
    refresh_token = create_token(user.id, user.role, timedelta(days=settings.refresh_token_expire_days))

    db.add(AuditLog(user_id=user.id, action="user.login", entity_type="user", entity_id=user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(token: str, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        role = payload.get("role")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    access_token = create_token(user_id, role, timedelta(minutes=settings.access_token_expire_minutes))
    refresh_token = create_token(user_id, role, timedelta(days=settings.refresh_token_expire_days))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/onboarding", response_model=UserResponse)
async def complete_onboarding(
    survey: OnboardingSurvey,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.year_level = survey.year_level
    current_user.institution = survey.institution
    current_user.specialty = survey.specialty
    current_user.prior_anatomy_courses = survey.prior_anatomy_courses
    current_user.fluoroscopy_experience = survey.fluoroscopy_experience
    current_user.onboarding_complete = True
    await db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="user.onboarding_complete",
        entity_type="user",
        entity_id=current_user.id,
        details={
            "year_level": survey.year_level,
            "institution": survey.institution,
            "fluoroscopy_experience": survey.fluoroscopy_experience,
        },
    ))
    return current_user
