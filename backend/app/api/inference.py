from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image as PILImage
import hashlib
import io

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.image import Image, LandmarkDefinition
from app.models.annotation import InferenceResult
from app.models.audit import AuditLog
from app.api.deps import get_current_user
from app.services.vision_api_service import predict_landmarks

router = APIRouter(prefix="/api/inference", tags=["inference"])


@router.post("/predict")
async def predict(
    file: UploadFile = File(...),
    body_region: str = Form("oblique_lumbar"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()

    # Get image dimensions
    pil_image = PILImage.open(io.BytesIO(content))
    width, height = pil_image.size

    # Save image to database (for audit trail)
    content_hash = hashlib.sha256(content).hexdigest()
    existing = (await db.execute(select(Image).where(Image.content_hash == content_hash))).scalar_one_or_none()

    if not existing:
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        hash_prefix = content_hash[:2]
        (upload_dir / hash_prefix).mkdir(exist_ok=True)
        ext = Path(file.filename or "image.png").suffix or ".png"
        storage_path = f"{hash_prefix}/{content_hash}{ext}"
        pil_image.save(str(upload_dir / storage_path))

        image = Image(
            filename=file.filename or "unnamed",
            storage_path=storage_path,
            content_hash=content_hash,
            width=width,
            height=height,
            body_region=body_region,
            uploaded_by=current_user.id,
        )
        db.add(image)
        await db.flush()
    else:
        image = existing

    # Get landmark definitions for body region
    landmarks = (await db.execute(
        select(LandmarkDefinition)
        .where(LandmarkDefinition.body_region == body_region)
        .order_by(LandmarkDefinition.sort_order)
    )).scalars().all()

    if not landmarks:
        raise HTTPException(status_code=400, detail=f"No landmark definitions for region: {body_region}")

    # Run prediction
    predictions = await predict_landmarks(content, width, height, body_region, landmarks)

    # Store result
    result = InferenceResult(
        image_id=image.id,
        predictions=predictions,
        model_source="vision_api",
        requested_by=current_user.id,
    )
    db.add(result)
    await db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="inference.predicted",
        entity_type="image",
        entity_id=image.id,
        details={"landmarks_predicted": len(predictions), "body_region": body_region},
    ))

    return {
        "id": result.id,
        "image_id": image.id,
        "image_width": width,
        "image_height": height,
        "predictions": predictions,
    }


@router.get("/results/{result_id}")
async def get_result(
    result_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = (await db.execute(
        select(InferenceResult).where(InferenceResult.id == result_id)
    )).scalar_one_or_none()

    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    image = (await db.execute(select(Image).where(Image.id == result.image_id))).scalar_one()

    return {
        "id": result.id,
        "image_id": result.image_id,
        "image_width": image.width,
        "image_height": image.height,
        "predictions": result.predictions,
        "created_at": result.created_at,
    }
