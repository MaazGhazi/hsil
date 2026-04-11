"""
Heatmap API — returns probability heatmap data for an image.

For each landmark on an image, returns:
- All individual annotations (with reliability weights)
- The weighted consensus center
- The sigma (spread) — defines the Gaussian heatmap radius
- Agreement score

This powers the heatmap visualization in the admin/expert view.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.image import Image, LandmarkDefinition
from app.models.annotation import Annotation, ConsensusAnnotation
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/api", tags=["heatmap"])


@router.get("/images/{image_id}/heatmap")
async def get_heatmap(
    image_id: str,
    current_user: User = Depends(require_role("admin", "expert")),
    db: AsyncSession = Depends(get_db),
):
    """Get probability heatmap data for all landmarks on an image."""

    image = (await db.execute(select(Image).where(Image.id == image_id))).scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Get landmark definitions
    landmarks = (await db.execute(
        select(LandmarkDefinition)
        .where(LandmarkDefinition.body_region == image.body_region)
        .order_by(LandmarkDefinition.sort_order)
    )).scalars().all()

    # Get all annotations
    all_anns = (await db.execute(
        select(Annotation).where(
            Annotation.image_id == image_id,
            Annotation.annotation_type == "keypoint",
        )
    )).scalars().all()

    # Get user reliability scores
    user_ids = list(set(a.user_id for a in all_anns))
    users = {}
    if user_ids:
        user_results = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users = {u.id: u for u in user_results}

    # Get consensus data
    consensus_anns = (await db.execute(
        select(ConsensusAnnotation).where(ConsensusAnnotation.image_id == image_id)
    )).scalars().all()
    consensus_map = {c.landmark_def_id: c for c in consensus_anns}

    # Build heatmap response
    heatmap_data = []
    for landmark in landmarks:
        landmark_anns = [a for a in all_anns if a.landmark_def_id == landmark.id]
        consensus = consensus_map.get(landmark.id)

        # Individual annotation points with reliability
        points = []
        for ann in landmark_anns:
            user = users.get(ann.user_id)
            points.append({
                "x": ann.data.get("x", 0),
                "y": ann.data.get("y", 0),
                "reliability": user.accuracy_score if user and user.accuracy_score is not None else 0.5,
                "is_expert": ann.is_expert,
                "user_name": user.full_name if user else "Unknown",
            })

        heatmap_data.append({
            "landmark_id": landmark.id,
            "landmark_name": landmark.name,
            "display_name": landmark.display_name,
            "num_annotations": len(points),
            "points": points,
            "consensus": {
                "x": consensus.consensus_data.get("x"),
                "y": consensus.consensus_data.get("y"),
                "sigma": consensus.consensus_data.get("sigma", 0),
                "heatmap_radius": consensus.consensus_data.get("heatmap_radius", 10),
                "agreement_score": consensus.agreement_score,
                "method": consensus.method,
                "is_training_ready": consensus.is_training_ready,
            } if consensus else None,
        })

    return {
        "image_id": image_id,
        "image_width": image.width,
        "image_height": image.height,
        "body_region": image.body_region,
        "total_annotators": len(user_ids),
        "landmarks": heatmap_data,
    }
