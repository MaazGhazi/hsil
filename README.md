# HSIL — Fluoroscopy Landmark Labeling & Surgical AI Overlay

A medical imaging platform where students annotate fluoroscopy images (e.g., the "Scottie dog" on oblique lumbar spine views), their accuracy is validated against expert ground truth, and an AI overlay helps surgeons identify anatomical landmarks during procedures.

## Architecture

- **Backend**: Python / FastAPI / SQLAlchemy / SQLite
- **Frontend**: React / TypeScript / Vite / TanStack Query / react-konva / Tailwind CSS
- **Inference**: Vision API (GPT-4o) for MVP, swappable for a custom model
- **Animation**: Remotion — animated ML pipeline explainer

## Quick Start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi "uvicorn[standard]" sqlalchemy alembic aiosqlite "bcrypt==4.2.1" "python-jose[cryptography]" python-multipart pydantic-settings pillow httpx openai greenlet
cp .env.example .env  # Edit with your OpenAI API key if you want real inference
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000 — API docs at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173 — proxies `/api` to the backend.

### Animation

```bash
cd animation
npm install
npm run preview  # Opens Remotion Studio
npm run render   # Renders to out/ml-pipeline.mp4
```

## User Roles

| Role | Access |
|------|--------|
| **Student** | Label images, view accuracy feedback |
| **Expert** | Label images (annotations marked as expert), manage ground truth |
| **Surgeon** | Upload images for AI landmark overlay |
| **Admin** | Upload images, manage users, view accuracy, trigger consensus |

## API Endpoints

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Images | `GET /api/images`, `POST /api/images`, `GET /api/images/next-task`, `GET /api/images/{id}/file` |
| Landmarks | `GET /api/landmarks`, `POST /api/landmarks` |
| Annotations | `POST /api/images/{id}/annotations`, `GET /api/annotations/my-stats` |
| Accuracy | `GET /api/accuracy/leaderboard`, `POST /api/accuracy/recompute` |
| Consensus | `POST /api/images/{id}/consensus/compute`, `POST /api/consensus/compute-all` |
| Inference | `POST /api/inference/predict` |

## Body Regions

Pre-seeded landmark definitions for:
- **Oblique Lumbar** (7 landmarks — Scottie dog anatomy)
- **AP Lumbar** (7 landmarks)
- **Lateral Lumbar** (5 landmarks)
- **AP Pelvis** (7 landmarks)

## Data Flow

```
Students annotate → Accuracy validated against expert GT → Consensus computed
→ Vision API predicts landmarks → Surgeon sees overlay with confidence scores
```

Without an OpenAI API key, the inference endpoint returns mock predictions for development.
