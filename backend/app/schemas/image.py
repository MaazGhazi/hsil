from pydantic import BaseModel
from datetime import datetime


class ImageResponse(BaseModel):
    id: str
    filename: str
    width: int
    height: int
    modality: str
    body_region: str | None
    is_expert_ground_truth: bool
    priority_score: float
    created_at: datetime
    uploaded_by: str | None

    model_config = {"from_attributes": True}


class ImageListResponse(BaseModel):
    images: list[ImageResponse]
    total: int


class LandmarkDefinitionResponse(BaseModel):
    id: str
    name: str
    display_name: str
    body_region: str
    description: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class LandmarkDefinitionCreate(BaseModel):
    name: str
    display_name: str
    body_region: str
    description: str | None = None
    sort_order: int = 0
