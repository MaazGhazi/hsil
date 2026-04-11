import hashlib
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from PIL import Image as PILImage
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.image import Image, LandmarkDefinition
from app.models.annotation import Annotation
from app.models.audit import AuditLog
from app.api.deps import get_current_user, require_role
from app.schemas.image import ImageResponse, ImageListResponse, LandmarkDefinitionResponse, LandmarkDefinitionCreate

router = APIRouter(prefix="/api", tags=["images"])


@router.post("/images", response_model=ImageResponse, status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    body_region: str = Form(None),
    is_expert_ground_truth: bool = Form(False),
    current_user: User = Depends(require_role("admin", "expert")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    content_hash = hashlib.sha256(content).hexdigest()

    # Check for duplicate
    existing = await db.execute(select(Image).where(Image.content_hash == content_hash))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Image already uploaded")

    # Get image dimensions
    import io
    pil_image = PILImage.open(io.BytesIO(content))
    width, height = pil_image.size

    # Strip EXIF/metadata for HIPAA (save clean version)
    clean_image = PILImage.new(pil_image.mode, pil_image.size)
    clean_image.putdata(list(pil_image.getdata()))

    # Save to disk
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    hash_prefix = content_hash[:2]
    (upload_dir / hash_prefix).mkdir(exist_ok=True)

    ext = Path(file.filename or "image.png").suffix or ".png"
    storage_path = f"{hash_prefix}/{content_hash}{ext}"
    full_path = upload_dir / storage_path
    clean_image.save(str(full_path))

    image = Image(
        filename=file.filename or "unnamed",
        storage_path=storage_path,
        content_hash=content_hash,
        width=width,
        height=height,
        body_region=body_region,
        is_expert_ground_truth=is_expert_ground_truth,
        uploaded_by=current_user.id,
    )
    db.add(image)
    await db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="image.uploaded",
        entity_type="image",
        entity_id=image.id,
        details={"filename": file.filename, "body_region": body_region, "is_gt": is_expert_ground_truth},
    ))
    return image


@router.get("/images", response_model=ImageListResponse)
async def list_images(
    body_region: str | None = Query(None),
    is_ground_truth: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Image)
    count_query = select(func.count(Image.id))

    if body_region:
        query = query.where(Image.body_region == body_region)
        count_query = count_query.where(Image.body_region == body_region)
    if is_ground_truth is not None:
        query = query.where(Image.is_expert_ground_truth == is_ground_truth)
        count_query = count_query.where(Image.is_expert_ground_truth == is_ground_truth)

    query = query.order_by(Image.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    total = (await db.execute(count_query)).scalar()
    return ImageListResponse(images=result.scalars().all(), total=total)


@router.get("/images/next-task", response_model=ImageResponse)
async def next_task(
    body_region: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get images the user hasn't annotated yet, ordered by priority
    annotated_subq = select(Annotation.image_id).where(Annotation.user_id == current_user.id).subquery()
    query = select(Image).where(Image.id.not_in(select(annotated_subq)))

    if body_region:
        query = query.where(Image.body_region == body_region)

    query = query.order_by(Image.priority_score.desc(), Image.created_at.asc()).limit(1)
    result = await db.execute(query)
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="No more images to label")
    return image


@router.get("/images/{image_id}", response_model=ImageResponse)
async def get_image(image_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.get("/images/{image_id}/file")
async def get_image_file(image_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    full_path = Path(settings.upload_dir) / image.storage_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk")
    return FileResponse(str(full_path))


# --- Landmark Definitions ---

@router.get("/landmarks", response_model=list[LandmarkDefinitionResponse])
async def list_landmarks(
    body_region: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(LandmarkDefinition)
    if body_region:
        query = query.where(LandmarkDefinition.body_region == body_region)
    query = query.order_by(LandmarkDefinition.body_region, LandmarkDefinition.sort_order)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/landmarks", response_model=LandmarkDefinitionResponse, status_code=201)
async def create_landmark(
    req: LandmarkDefinitionCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    landmark = LandmarkDefinition(**req.model_dump())
    db.add(landmark)
    await db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="landmark.created",
        entity_type="landmark_definition",
        entity_id=landmark.id,
        details={"name": req.name, "body_region": req.body_region},
    ))
    return landmark
