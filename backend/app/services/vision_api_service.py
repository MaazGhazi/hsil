import base64
import json
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.models.image import LandmarkDefinition

logger = logging.getLogger(__name__)


class LandmarkPrediction:
    def __init__(self, landmark_name: str, display_name: str, x: float, y: float, confidence: float):
        self.landmark_name = landmark_name
        self.display_name = display_name
        self.x = x
        self.y = y
        self.confidence = confidence

    def to_dict(self):
        return {
            "landmark_name": self.landmark_name,
            "display_name": self.display_name,
            "x": self.x,
            "y": self.y,
            "confidence": self.confidence,
        }


async def predict_landmarks(
    image_bytes: bytes,
    image_width: int,
    image_height: int,
    body_region: str,
    landmarks: list[LandmarkDefinition],
) -> list[dict]:
    """Use GPT-4o vision to detect anatomical landmarks on a fluoroscopy image."""

    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not set — returning mock predictions")
        return _mock_predictions(image_width, image_height, landmarks)

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    landmark_list = "\n".join(
        f"- {l.name}: {l.display_name} — {l.description or 'no description'}"
        for l in landmarks
    )

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    region_display = body_region.replace("_", " ")

    prompt = f"""You are an expert musculoskeletal radiologist. You are looking at a {region_display} fluoroscopy image that is {image_width} pixels wide and {image_height} pixels tall.

The pixel coordinate system has (0, 0) at the top-left corner. X increases to the right, Y increases downward.

Your task: locate each of the following anatomical landmarks and estimate their pixel coordinates as precisely as possible.

Landmarks to find:
{landmark_list}

Instructions:
1. First, identify the overall anatomy visible in the image — vertebral bodies, processes, pedicles, etc.
2. For each landmark, estimate its CENTER position in pixel coordinates.
3. Think about anatomical relationships — e.g. pedicles are lateral to the vertebral body, transverse processes extend further lateral, spinous process is posterior/midline.
4. Use the full image dimensions ({image_width}x{image_height}) to calibrate your estimates — landmarks should be spread across the area where the spine is visible, not clustered in one spot.
5. Assign confidence: 0.9+ if the structure is clearly visible, 0.5–0.8 if partially visible or you're estimating from context, below 0.3 if you cannot identify it.

Return ONLY a JSON array, no markdown fences, no explanation:
[
  {{"landmark_name": "<name>", "display_name": "<display>", "x": <int>, "y": <int>, "confidence": <float>}}
]"""

    try:
        logger.info(f"Calling GPT-4o for {region_display} inference ({image_width}x{image_height})")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{b64_image}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=2000,
            temperature=0.1,
        )

        content = response.choices[0].message.content or ""
        logger.info(f"GPT-4o raw response: {content[:500]}")

        # Extract JSON from response
        json_start = content.find("[")
        json_end = content.rfind("]") + 1
        if json_start >= 0 and json_end > json_start:
            predictions = json.loads(content[json_start:json_end])
            validated = []
            for pred in predictions:
                validated.append({
                    "landmark_name": pred.get("landmark_name", "unknown"),
                    "display_name": pred.get("display_name", "Unknown"),
                    "x": max(0, min(image_width, float(pred.get("x", 0)))),
                    "y": max(0, min(image_height, float(pred.get("y", 0)))),
                    "confidence": max(0.0, min(1.0, float(pred.get("confidence", 0.5)))),
                })
            logger.info(f"GPT-4o returned {len(validated)} landmarks")
            return validated
        else:
            logger.error(f"No JSON array in GPT-4o response: {content[:300]}")
            return _mock_predictions(image_width, image_height, landmarks)

    except Exception as e:
        # Log the actual error so you can see it in the terminal
        logger.error(f"GPT-4o API call FAILED: {type(e).__name__}: {e}")
        return _mock_predictions(image_width, image_height, landmarks)


def _mock_predictions(width: int, height: int, landmarks: list[LandmarkDefinition]) -> list[dict]:
    """Generate plausible mock predictions for development without an API key."""
    import random
    random.seed(42)

    logger.warning("Using MOCK predictions — results are not real")

    cx, cy = width * 0.45, height * 0.45
    predictions = []
    for i, lm in enumerate(landmarks):
        angle = (i / len(landmarks)) * 6.28
        r = min(width, height) * 0.15
        x = cx + r * (0.8 + random.random() * 0.4) * (1 if i % 2 == 0 else -1) * (0.5 + 0.5 * abs(angle % 3.14 - 1.57) / 1.57)
        y = cy + r * (0.8 + random.random() * 0.4) * (1 if i % 3 == 0 else -1) * (0.5 + 0.5 * abs(angle % 3.14 - 1.57) / 1.57)
        predictions.append({
            "landmark_name": lm.name,
            "display_name": lm.display_name,
            "x": round(max(20, min(width - 20, x)), 1),
            "y": round(max(20, min(height - 20, y)), 1),
            "confidence": round(0.6 + random.random() * 0.35, 2),
        })
    return predictions
