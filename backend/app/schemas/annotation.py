from pydantic import BaseModel
from datetime import datetime


class AnnotationCreate(BaseModel):
    landmark_def_id: str
    annotation_type: str = "keypoint"  # keypoint, region, label
    data: dict  # {"x": 234.5, "y": 189.2} for keypoints


class AnnotationBatchCreate(BaseModel):
    annotations: list[AnnotationCreate]


class AnnotationResponse(BaseModel):
    id: str
    image_id: str
    user_id: str
    annotation_type: str
    landmark_def_id: str | None
    data: dict
    is_expert: bool
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AnnotationStatsResponse(BaseModel):
    total_annotations: int
    images_labeled: int
    accuracy_score: float | None


class ConsensusResponse(BaseModel):
    id: str
    image_id: str
    landmark_def_id: str
    consensus_data: dict
    num_annotators: int
    agreement_score: float
    is_training_ready: bool

    model_config = {"from_attributes": True}
