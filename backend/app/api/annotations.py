from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.annotation import Annotation, ConsensusAnnotation
from app.models.audit import AuditLog
from app.api.deps import get_current_user
from app.api.auth import award_xp
from app.schemas.annotation import (
    AnnotationBatchCreate,
    AnnotationResponse,
    AnnotationStatsResponse,
    ConsensusResponse,
)

router = APIRouter(prefix="/api", tags=["annotations"])


@router.post("/images/{image_id}/annotations", status_code=201)
async def submit_annotations(
    image_id: str,
    req: AnnotationBatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    created = []
    new_count = 0
    for ann in req.annotations:
        existing = await db.execute(
            select(Annotation).where(
                Annotation.image_id == image_id,
                Annotation.user_id == current_user.id,
                Annotation.landmark_def_id == ann.landmark_def_id,
            )
        )
        existing_ann = existing.scalar_one_or_none()

        if existing_ann:
            existing_ann.data = ann.data
            existing_ann.annotation_type = ann.annotation_type
            created.append(existing_ann)
        else:
            annotation = Annotation(
                image_id=image_id,
                user_id=current_user.id,
                annotation_type=ann.annotation_type,
                landmark_def_id=ann.landmark_def_id,
                data=ann.data,
                is_expert=current_user.role == "expert",
            )
            db.add(annotation)
            created.append(annotation)
            new_count += 1

    await db.flush()

    # Award XP for new annotations on this image
    xp_changes = award_xp(current_user, images_labeled=1)

    db.add(AuditLog(
        user_id=current_user.id,
        action="annotation.submitted",
        entity_type="image",
        entity_id=image_id,
        details={"count": len(req.annotations), "xp_earned": xp_changes.get("xp_earned", 0)},
    ))

    return {
        "annotations": [AnnotationResponse.model_validate(a) for a in created],
        "xp": xp_changes,
    }


@router.get("/images/{image_id}/annotations", response_model=list[AnnotationResponse])
async def get_annotations(
    image_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Annotation).where(Annotation.image_id == image_id)

    if current_user.role == "student":
        query = query.where(Annotation.user_id == current_user.id)

    result = await db.execute(query.order_by(Annotation.created_at))
    return result.scalars().all()


@router.get("/annotations/my-stats", response_model=AnnotationStatsResponse)
async def my_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count(Annotation.id)).where(Annotation.user_id == current_user.id)
    )).scalar()

    images = (await db.execute(
        select(func.count(func.distinct(Annotation.image_id))).where(Annotation.user_id == current_user.id)
    )).scalar()

    return AnnotationStatsResponse(
        total_annotations=total or 0,
        images_labeled=images or 0,
        accuracy_score=current_user.accuracy_score,
    )


@router.get("/images/{image_id}/community")
async def get_community_annotations(
    image_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get anonymized annotations from all other users on this image.
    Only shown AFTER the current user has submitted their own annotations."""

    # Verify current user has submitted on this image
    own = (await db.execute(
        select(func.count(Annotation.id)).where(
            Annotation.image_id == image_id,
            Annotation.user_id == current_user.id,
        )
    )).scalar()

    if not own or own == 0:
        raise HTTPException(status_code=403, detail="Submit your annotations first to see community labels")

    # Get all OTHER users' annotations (anonymized)
    others = (await db.execute(
        select(Annotation).where(
            Annotation.image_id == image_id,
            Annotation.user_id != current_user.id,
        )
    )).scalars().all()

    # Group by landmark
    from collections import defaultdict
    by_landmark: dict[str, list[dict]] = defaultdict(list)
    for ann in others:
        by_landmark[ann.landmark_def_id or "unknown"].append({
            "x": ann.data.get("x", 0),
            "y": ann.data.get("y", 0),
            "w": ann.data.get("w", 0),
            "h": ann.data.get("h", 0),
            "is_expert": ann.is_expert,
        })

    return {
        "image_id": image_id,
        "total_other_annotators": len(set(a.user_id for a in others)),
        "landmarks": {
            lid: {"count": len(anns), "boxes": anns}
            for lid, anns in by_landmark.items()
        },
    }


@router.get("/images/{image_id}/consensus", response_model=list[ConsensusResponse])
async def get_consensus(
    image_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConsensusAnnotation).where(ConsensusAnnotation.image_id == image_id)
    )
    return result.scalars().all()
