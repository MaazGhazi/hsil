"""
Bulk import Kaggle vertebrae X-ray images into HSIL.

Usage:
    python scripts/import_kaggle_images.py

Expects the dataset at: data/kaggle_download/vertebrae/xkt857dsxk-1/ImagesOriginalSize/
"""
import asyncio
import hashlib
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image
from app.database import engine, Base, async_session
from app.models.image import Image as ImageModel
from app.models.user import User
from app.config import settings
from sqlalchemy import select

DATASET_ROOT = Path(__file__).resolve().parent.parent.parent / "data" / "kaggle_download" / "vertebrae" / "xkt857dsxk-1" / "ImagesOriginalSize"

# Map dataset categories to body regions and whether they're spondylolisthesis (lateral views)
CATEGORY_MAP = {
    "NormalFinal": {"body_region": "ap_lumbar", "label": "Normal spine"},
    "ScolFinal": {"body_region": "ap_lumbar", "label": "Scoliosis"},
    "SpondFinal": {"body_region": "lateral_lumbar", "label": "Spondylolisthesis"},
}


async def main():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed landmarks if needed
    from app.main import seed_landmarks
    await seed_landmarks()

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    imported = 0
    skipped = 0
    errors = 0

    async with async_session() as session:
        # Get or create a system admin user for uploads
        result = await session.execute(select(User).where(User.role == "admin").limit(1))
        admin = result.scalar_one_or_none()

        if not admin:
            import bcrypt
            admin = User(
                email="system@hsil.local",
                password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode(),
                full_name="System Admin",
                role="admin",
            )
            session.add(admin)
            await session.flush()
            print(f"Created system admin: system@hsil.local / admin123")

        for category, info in CATEGORY_MAP.items():
            cat_dir = DATASET_ROOT / category
            if not cat_dir.exists():
                print(f"  Skipping {category}: directory not found")
                continue

            files = sorted([f for f in cat_dir.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png')])
            print(f"\n{category}: {len(files)} images → {info['body_region']}")

            # Mark first 5 images of each category as ground truth for expert labeling
            gt_count = 5

            for i, filepath in enumerate(files):
                try:
                    content = filepath.read_bytes()
                    content_hash = hashlib.sha256(content).hexdigest()

                    # Check for duplicate
                    existing = await session.execute(
                        select(ImageModel).where(ImageModel.content_hash == content_hash)
                    )
                    if existing.scalar_one_or_none():
                        skipped += 1
                        continue

                    # Get dimensions
                    pil_img = Image.open(filepath)
                    width, height = pil_img.size

                    # Convert to RGB if needed and strip metadata
                    if pil_img.mode != "RGB":
                        pil_img = pil_img.convert("RGB")

                    # Save clean copy
                    hash_prefix = content_hash[:2]
                    (upload_dir / hash_prefix).mkdir(exist_ok=True)
                    storage_path = f"{hash_prefix}/{content_hash}.jpg"
                    pil_img.save(str(upload_dir / storage_path), "JPEG", quality=95)

                    is_gt = i < gt_count

                    image = ImageModel(
                        filename=filepath.name,
                        storage_path=storage_path,
                        content_hash=content_hash,
                        width=width,
                        height=height,
                        modality="xray",
                        body_region=info["body_region"],
                        is_expert_ground_truth=is_gt,
                        uploaded_by=admin.id,
                        upload_metadata={"source": "kaggle", "category": category, "label": info["label"]},
                    )
                    session.add(image)
                    imported += 1

                    if imported % 50 == 0:
                        await session.flush()
                        print(f"  ... imported {imported} so far")

                except Exception as e:
                    errors += 1
                    print(f"  Error: {filepath.name}: {e}")

        await session.commit()

    print(f"\nDone! Imported: {imported}, Skipped (duplicates): {skipped}, Errors: {errors}")
    print(f"Ground truth: {gt_count} per category ({gt_count * len(CATEGORY_MAP)} total)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
