from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import engine, Base, async_session
from app.models import user, image, annotation, audit  # noqa: F401 - register models with Base
from app.models.image import LandmarkDefinition
from app.api.auth import router as auth_router
from app.api.images import router as images_router
from app.api.annotations import router as annotations_router
from app.api.accuracy import router as accuracy_router
from app.api.inference import router as inference_router
from app.api.heatmap import router as heatmap_router

LANDMARK_SEEDS = [
    # Oblique Lumbar Spine — Scottie Dog
    ("scottie_dog_eye", "Eye (Pedicle)", "oblique_lumbar", "The pedicle, seen as the eye of the Scottie dog", 1),
    ("scottie_dog_ear", "Ear (Superior Articular Process)", "oblique_lumbar", "The superior articular process", 2),
    ("scottie_dog_nose", "Nose (Transverse Process)", "oblique_lumbar", "The transverse process", 3),
    ("scottie_dog_front_leg", "Front Leg (Inferior Articular Process)", "oblique_lumbar", "The inferior articular process", 4),
    ("scottie_dog_body", "Body (Lamina)", "oblique_lumbar", "The lamina of the vertebra", 5),
    ("scottie_dog_tail", "Tail (Superior Articular Process, opposite side)", "oblique_lumbar", "The contralateral superior articular process", 6),
    ("scottie_dog_hind_leg", "Hind Leg (Inferior Articular Process, opposite side)", "oblique_lumbar", "The contralateral inferior articular process", 7),
    # AP Lumbar Spine
    ("ap_spinous_process", "Spinous Process", "ap_lumbar", "Midline spinous process", 1),
    ("ap_pedicle_left", "Left Pedicle", "ap_lumbar", "Left pedicle shadow", 2),
    ("ap_pedicle_right", "Right Pedicle", "ap_lumbar", "Right pedicle shadow", 3),
    ("ap_transverse_process_left", "Left Transverse Process", "ap_lumbar", "Left transverse process", 4),
    ("ap_transverse_process_right", "Right Transverse Process", "ap_lumbar", "Right transverse process", 5),
    ("ap_endplate_superior", "Superior Endplate", "ap_lumbar", "Superior vertebral endplate", 6),
    ("ap_endplate_inferior", "Inferior Endplate", "ap_lumbar", "Inferior vertebral endplate", 7),
    # Lateral Lumbar Spine
    ("lat_vertebral_body_anterior", "Vertebral Body Anterior", "lateral_lumbar", "Anterior border of vertebral body", 1),
    ("lat_vertebral_body_posterior", "Vertebral Body Posterior", "lateral_lumbar", "Posterior border of vertebral body", 2),
    ("lat_spinous_process", "Spinous Process", "lateral_lumbar", "Tip of spinous process", 3),
    ("lat_disc_space", "Disc Space", "lateral_lumbar", "Center of intervertebral disc", 4),
    ("lat_foramen", "Neural Foramen", "lateral_lumbar", "Center of neural foramen", 5),
    # AP Pelvis
    ("pelvis_sacral_promontory", "Sacral Promontory", "ap_pelvis", "Superior border of S1", 1),
    ("pelvis_si_joint_left", "Left SI Joint", "ap_pelvis", "Left sacroiliac joint", 2),
    ("pelvis_si_joint_right", "Right SI Joint", "ap_pelvis", "Right sacroiliac joint", 3),
    ("pelvis_acetabulum_left", "Left Acetabulum", "ap_pelvis", "Center of left acetabulum", 4),
    ("pelvis_acetabulum_right", "Right Acetabulum", "ap_pelvis", "Center of right acetabulum", 5),
    ("pelvis_obturator_foramen_left", "Left Obturator Foramen", "ap_pelvis", "Center of left obturator foramen", 6),
    ("pelvis_obturator_foramen_right", "Right Obturator Foramen", "ap_pelvis", "Center of right obturator foramen", 7),
]


async def seed_landmarks():
    async with async_session() as session:
        result = await session.execute(select(LandmarkDefinition).limit(1))
        if result.scalar_one_or_none() is not None:
            return  # Already seeded

        for name, display_name, body_region, description, sort_order in LANDMARK_SEEDS:
            session.add(LandmarkDefinition(
                name=name,
                display_name=display_name,
                body_region=body_region,
                description=description,
                sort_order=sort_order,
            ))
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_landmarks()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Fluoroscopy landmark labeling & surgical AI overlay",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(images_router)
app.include_router(annotations_router)
app.include_router(accuracy_router)
app.include_router(inference_router)
app.include_router(heatmap_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
