import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, Float, Integer, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Annotation(Base):
    __tablename__ = "annotations"
    __table_args__ = (
        UniqueConstraint("image_id", "user_id", "landmark_def_id", name="uq_annotation_per_user_landmark"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    image_id: Mapped[str] = mapped_column(String(36), ForeignKey("images.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    annotation_type: Mapped[str] = mapped_column(String(20), nullable=False, default="keypoint")  # keypoint, region, label
    landmark_def_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("landmark_definitions.id"), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)  # {"x": 234.5, "y": 189.2} for keypoints
    is_expert: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="submitted")  # submitted, accepted, rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ConsensusAnnotation(Base):
    __tablename__ = "consensus_annotations"
    __table_args__ = (
        UniqueConstraint("image_id", "landmark_def_id", name="uq_consensus_per_landmark"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    image_id: Mapped[str] = mapped_column(String(36), ForeignKey("images.id"), nullable=False, index=True)
    landmark_def_id: Mapped[str] = mapped_column(String(36), ForeignKey("landmark_definitions.id"), nullable=False)
    consensus_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    num_annotators: Mapped[int] = mapped_column(Integer, nullable=False)
    agreement_score: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String(50), nullable=False)  # mean, median, expert_override
    is_training_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class InferenceResult(Base):
    __tablename__ = "inference_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    image_id: Mapped[str] = mapped_column(String(36), ForeignKey("images.id"), nullable=False)
    predictions: Mapped[dict] = mapped_column(JSON, nullable=False)
    model_source: Mapped[str] = mapped_column(String(50), default="vision_api")  # vision_api, custom_model
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    requested_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
