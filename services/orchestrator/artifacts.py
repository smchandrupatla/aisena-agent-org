"""Implementation artifacts and peer review (spec Section 5: agents implement,
produce artifacts, and converge through peer review by another agent).

An artifact is whatever a workstream's assigned expert produces (a file, a
design doc reference, a PR description, etc.) — this store doesn't care about
the artifact's actual content/format, only its review lifecycle. A separate
review is recorded per peer-review verdict so the full review history (not
just the latest verdict) stays auditable.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from models import Artifact, Review


class ArtifactStore:
    def __init__(self, root_dir: Path):
        self.root_dir = Path(root_dir) / "artifacts"
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path_for(self, app_id: str) -> Path:
        return self.root_dir / f"{app_id}.json"

    def _load(self, app_id: str) -> list[dict[str, Any]]:
        path = self._path_for(app_id)
        if not path.exists():
            return []
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save(self, app_id: str, artifacts: list[dict[str, Any]]) -> None:
        self._path_for(app_id).write_text(json.dumps(artifacts, indent=2), encoding="utf-8")

    def list_artifacts(self, app_id: str) -> list[dict[str, Any]]:
        return self._load(app_id)

    def get_artifact(self, app_id: str, artifact_id: str) -> dict[str, Any] | None:
        return next((a for a in self._load(app_id) if a["id"] == artifact_id), None)

    def create_artifact(
        self,
        app_id: str,
        workstream_id: str,
        title: str,
        description: str,
        produced_by: str | None,
        reviewers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        with self._lock:
            artifacts = self._load(app_id)
            numbers = [int(a["id"].replace("ARTIFACT-", "")) for a in artifacts if a["id"].startswith("ARTIFACT-")]
            next_num = max(numbers) + 1 if numbers else 1
            artifact = Artifact(
                id=f"ARTIFACT-{str(next_num).zfill(4)}",
                app_id=app_id,
                workstream_id=workstream_id,
                produced_by=produced_by,
                title=title,
                description=description,
                reviewers=reviewers,
            ).to_dict()
            artifacts.append(artifact)
            self._save(app_id, artifacts)
            return artifact

    def update_status(self, app_id: str, artifact_id: str, status: str) -> dict[str, Any] | None:
        with self._lock:
            artifacts = self._load(app_id)
            artifact = next((a for a in artifacts if a["id"] == artifact_id), None)
            if not artifact:
                return None
            artifact["status"] = status
            self._save(app_id, artifacts)
            return artifact


class ReviewStore:
    def __init__(self, root_dir: Path):
        self.root_dir = Path(root_dir) / "reviews"
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path_for(self, app_id: str) -> Path:
        return self.root_dir / f"{app_id}.json"

    def _load(self, app_id: str) -> list[dict[str, Any]]:
        path = self._path_for(app_id)
        if not path.exists():
            return []
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save(self, app_id: str, reviews: list[dict[str, Any]]) -> None:
        self._path_for(app_id).write_text(json.dumps(reviews, indent=2), encoding="utf-8")

    def list_reviews(self, app_id: str, artifact_id: str | None = None) -> list[dict[str, Any]]:
        reviews = self._load(app_id)
        if artifact_id is None:
            return reviews
        return [r for r in reviews if r["artifact_id"] == artifact_id]

    def create_review(self, app_id: str, artifact_id: str, reviewer: str | None, verdict: str, comments: str) -> dict[str, Any]:
        with self._lock:
            reviews = self._load(app_id)
            numbers = [int(r["id"].replace("REVIEW-", "")) for r in reviews if r["id"].startswith("REVIEW-")]
            next_num = max(numbers) + 1 if numbers else 1
            review = Review(
                id=f"REVIEW-{str(next_num).zfill(4)}",
                app_id=app_id,
                artifact_id=artifact_id,
                reviewer=reviewer,
                verdict=verdict,
                comments=comments,
            ).to_dict()
            reviews.append(review)
            self._save(app_id, reviews)
            return review
