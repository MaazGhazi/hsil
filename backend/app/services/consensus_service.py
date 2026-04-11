"""
Probabilistic Consensus Engine

Instead of simple averaging, this uses reliability-weighted consensus:
- Each student has a Reliability Score (R = accuracy_score)
- A student with R=0.9 marking a pedicle carries more weight than R=0.4
- Output is a probability heatmap: weighted center + spread (sigma)
- The heatmap data can train a CNN that learns the "center of mass"

Expert annotations override with R=1.0 and sigma=0.
"""
import math
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.models.image import Image, LandmarkDefinition
from app.models.annotation import Annotation, ConsensusAnnotation


async def compute_consensus_for_image(image_id: str, db: AsyncSession) -> list[ConsensusAnnotation]:
    """Compute reliability-weighted consensus for all landmarks on an image.

    For each landmark:
      1. Gather annotations from all users who have labeled it
      2. Weight each annotation by the user's Reliability Score (accuracy_score)
      3. Compute weighted center-of-mass (x, y)
      4. Compute weighted spread (sigma) — the heatmap radius
      5. Store as consensus with heatmap data
    """

    image = (await db.execute(select(Image).where(Image.id == image_id))).scalar_one_or_none()
    if not image or not image.body_region:
        return []

    landmarks = (await db.execute(
        select(LandmarkDefinition).where(LandmarkDefinition.body_region == image.body_region)
    )).scalars().all()

    # Get all keypoint annotations for this image
    all_anns = (await db.execute(
        select(Annotation).where(
            Annotation.image_id == image_id,
            Annotation.annotation_type == "keypoint",
            Annotation.landmark_def_id.isnot(None),
        )
    )).scalars().all()

    # Load reliability scores for all annotators
    user_ids = list(set(a.user_id for a in all_anns))
    if not user_ids:
        return []

    users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    user_map = {u.id: u for u in users}

    # Group annotations by landmark
    by_landmark: dict[str, list[Annotation]] = defaultdict(list)
    expert_by_landmark: dict[str, Annotation] = {}

    for ann in all_anns:
        if ann.is_expert:
            expert_by_landmark[ann.landmark_def_id] = ann
        else:
            by_landmark[ann.landmark_def_id].append(ann)

    results = []

    for landmark in landmarks:
        expert_ann = expert_by_landmark.get(landmark.id)
        student_anns = by_landmark.get(landmark.id, [])

        # Delete existing consensus
        existing = (await db.execute(
            select(ConsensusAnnotation).where(
                ConsensusAnnotation.image_id == image_id,
                ConsensusAnnotation.landmark_def_id == landmark.id,
            )
        )).scalar_one_or_none()
        if existing:
            await db.delete(existing)

        if expert_ann:
            # Expert override — perfect reliability, zero spread
            consensus = ConsensusAnnotation(
                image_id=image_id,
                landmark_def_id=landmark.id,
                consensus_data={
                    "x": expert_ann.data.get("x", 0),
                    "y": expert_ann.data.get("y", 0),
                    "sigma": 0,
                    "heatmap_radius": 5,
                    "weights": [{"user_id": expert_ann.user_id, "reliability": 1.0}],
                },
                num_annotators=1,
                agreement_score=1.0,
                method="expert_override",
                is_training_ready=True,
            )
            db.add(consensus)
            results.append(consensus)

        elif len(student_anns) >= settings.min_annotators_for_consensus:
            # --- Reliability-weighted consensus ---

            # Get reliability score for each annotator (default 0.5 if no score yet)
            weights = []
            for ann in student_anns:
                user = user_map.get(ann.user_id)
                r = user.accuracy_score if user and user.accuracy_score is not None else 0.5
                # Minimum reliability floor to prevent zero-weight
                r = max(r, 0.1)
                weights.append({
                    "user_id": ann.user_id,
                    "reliability": round(r, 3),
                    "x": ann.data.get("x", 0),
                    "y": ann.data.get("y", 0),
                })

            total_weight = sum(w["reliability"] for w in weights)
            if total_weight == 0:
                continue

            # Weighted center of mass
            wx = sum(w["reliability"] * w["x"] for w in weights) / total_weight
            wy = sum(w["reliability"] * w["y"] for w in weights) / total_weight

            # Weighted spread (sigma) — how tight the annotations cluster
            # Lower sigma = higher agreement = tighter heatmap
            weighted_var = sum(
                w["reliability"] * ((w["x"] - wx) ** 2 + (w["y"] - wy) ** 2)
                for w in weights
            ) / total_weight
            sigma = math.sqrt(weighted_var)

            # Agreement score: 1.0 = perfect agreement, 0.0 = total disagreement
            max_acceptable_sigma = 30.0  # pixels
            agreement = max(0.0, 1.0 - sigma / max_acceptable_sigma)

            # Heatmap radius for visualization (2-sigma covers ~95% of probability)
            heatmap_radius = max(8, sigma * 2)

            is_ready = agreement >= settings.consensus_agreement_threshold

            consensus = ConsensusAnnotation(
                image_id=image_id,
                landmark_def_id=landmark.id,
                consensus_data={
                    "x": round(wx, 1),
                    "y": round(wy, 1),
                    "sigma": round(sigma, 2),
                    "heatmap_radius": round(heatmap_radius, 1),
                    "weights": [
                        {"user_id": w["user_id"], "reliability": w["reliability"]}
                        for w in weights
                    ],
                    "annotations": [
                        {"x": w["x"], "y": w["y"], "r": w["reliability"]}
                        for w in weights
                    ],
                },
                num_annotators=len(student_anns),
                agreement_score=round(agreement, 3),
                method="reliability_weighted",
                is_training_ready=is_ready,
            )
            db.add(consensus)
            results.append(consensus)

    await db.flush()
    return results
