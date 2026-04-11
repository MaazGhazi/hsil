from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.image import Image
from app.models.audit import AuditLog
from app.api.deps import get_current_user, require_role
from app.services.accuracy_service import recompute_all_accuracies
from app.services.consensus_service import compute_consensus_for_image
from app.schemas.auth import UserResponse, LeaderboardEntry
from app.schemas.annotation import ConsensusResponse

router = APIRouter(prefix="/api", tags=["accuracy"])


@router.get("/accuracy/leaderboard")
async def leaderboard(
    sort_by: str = Query("xp", regex="^(xp|accuracy|images|streak)$"),
    year_level: str | None = Query(None),
    institution: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(
        User.role.in_(["student", "expert"]),
        User.total_images_labeled > 0,
    )

    if year_level:
        query = query.where(User.year_level == year_level)
    if institution:
        query = query.where(User.institution == institution)

    order_map = {
        "xp": User.xp_points.desc(),
        "accuracy": User.accuracy_score.desc().nullslast(),
        "images": User.total_images_labeled.desc(),
        "streak": User.best_streak.desc(),
    }
    query = query.order_by(order_map.get(sort_by, User.xp_points.desc())).limit(50)

    result = await db.execute(query)
    users = result.scalars().all()
    return [LeaderboardEntry.model_validate(u) for u in users]


@router.post("/accuracy/recompute")
async def recompute(
    current_user: User = Depends(require_role("admin", "expert")),
    db: AsyncSession = Depends(get_db),
):
    results = await recompute_all_accuracies(db)

    db.add(AuditLog(
        user_id=current_user.id,
        action="accuracy.recomputed",
        details={"users_updated": len(results)},
    ))
    return {"users_updated": len(results), "scores": {k: v for k, v in results.items() if v is not None}}


@router.post("/images/{image_id}/consensus/compute", response_model=list[ConsensusResponse])
async def compute_consensus(
    image_id: str,
    current_user: User = Depends(require_role("admin", "expert")),
    db: AsyncSession = Depends(get_db),
):
    results = await compute_consensus_for_image(image_id, db)

    db.add(AuditLog(
        user_id=current_user.id,
        action="consensus.computed",
        entity_type="image",
        entity_id=image_id,
        details={"landmarks_computed": len(results)},
    ))
    return results


@router.post("/consensus/compute-all")
async def compute_all_consensus(
    current_user: User = Depends(require_role("admin", "expert")),
    db: AsyncSession = Depends(get_db),
):
    images = (await db.execute(select(Image))).scalars().all()
    total_computed = 0

    for image in images:
        results = await compute_consensus_for_image(image.id, db)
        total_computed += len(results)

    db.add(AuditLog(
        user_id=current_user.id,
        action="consensus.computed_all",
        details={"total_landmarks": total_computed},
    ))
    return {"images_processed": len(images), "landmarks_computed": total_computed}
