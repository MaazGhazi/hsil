import math

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.models.image import Image
from app.models.annotation import Annotation


async def compute_user_accuracy(user_id: str, db: AsyncSession) -> float | None:
    """Compute a user's accuracy by comparing their annotations against expert annotations
    on ground truth images. Returns None if insufficient data."""

    # Get all ground truth images that this user has annotated
    gt_images = (await db.execute(
        select(Image.id).where(
            Image.is_expert_ground_truth == True,
            Image.id.in_(
                select(Annotation.image_id).where(Annotation.user_id == user_id)
            ),
        )
    )).scalars().all()

    if not gt_images:
        return None

    correct = 0
    total = 0
    threshold_px = 15  # pixels — within this distance counts as correct

    for image_id in gt_images:
        # Get user's keypoint annotations for this image
        user_anns = (await db.execute(
            select(Annotation).where(
                Annotation.image_id == image_id,
                Annotation.user_id == user_id,
                Annotation.annotation_type == "keypoint",
                Annotation.landmark_def_id.isnot(None),
            )
        )).scalars().all()

        # Get expert annotations for this image
        expert_anns = (await db.execute(
            select(Annotation).where(
                Annotation.image_id == image_id,
                Annotation.is_expert == True,
                Annotation.annotation_type == "keypoint",
                Annotation.landmark_def_id.isnot(None),
            )
        )).scalars().all()

        expert_map = {a.landmark_def_id: a.data for a in expert_anns}

        for user_ann in user_anns:
            expert_data = expert_map.get(user_ann.landmark_def_id)
            if not expert_data:
                continue

            # Euclidean distance
            dx = user_ann.data.get("x", 0) - expert_data.get("x", 0)
            dy = user_ann.data.get("y", 0) - expert_data.get("y", 0)
            distance = math.sqrt(dx * dx + dy * dy)

            total += 1
            if distance <= threshold_px:
                correct += 1

    if total == 0:
        return None

    return correct / total


async def recompute_all_accuracies(db: AsyncSession) -> dict[str, float | None]:
    """Recompute accuracy scores for all students. Returns {user_id: score}."""
    results = {}

    students = (await db.execute(
        select(User).where(User.role.in_(["student", "expert"]))
    )).scalars().all()

    for student in students:
        score = await compute_user_accuracy(student.id, db)
        student.accuracy_score = score
        results[student.id] = score

    return results
