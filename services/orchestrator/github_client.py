"""Thin GitHub REST API client with push-mode-aware PR handling (Section 4 of the spec).

Auto-push: commit + open PR + merge immediately, no human wait.
Manual approval: commit + open PR, left open for a human to review/merge.

A `session` can be injected (anything exposing `.request(method, url, **kwargs)`
returning an object with `.status_code`/`.json()`/`.text`) so this client is
unit-testable without real network access or credentials.
"""
from __future__ import annotations

import os
import re
from typing import Any

try:
    import requests
except Exception:  # pragma: no cover - requests is an expected dependency
    requests = None

_REPO_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")


class GitHubNotConfiguredError(RuntimeError):
    pass


class GitHubApiError(RuntimeError):
    pass


def _validate_repo_name(name: str) -> None:
    if not name or not _REPO_NAME_RE.match(name):
        raise ValueError(f"Invalid GitHub repository name: {name!r}")


class GitHubClient:
    def __init__(self, token: str | None = None, org: str | None = None, api_base: str = "https://api.github.com", session: Any = None):
        self.token = token if token is not None else os.environ.get("GITHUB_TOKEN")
        self.org = org if org is not None else os.environ.get("GITHUB_ORG")
        self.api_base = api_base.rstrip("/")
        self.session = session if session is not None else requests

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def _headers(self) -> dict[str, str]:
        if not self.token:
            raise GitHubNotConfiguredError("GITHUB_TOKEN is not configured")
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
        }

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if self.session is None:
            raise GitHubNotConfiguredError("No HTTP session/library available")
        url = f"{self.api_base}{path}"
        response = self.session.request(method, url, headers=self._headers(), timeout=15, **kwargs)
        if response.status_code >= 400:
            # Never echo request headers/body back into the error (could contain the token).
            raise GitHubApiError(f"GitHub API {method} {path} failed: {response.status_code}")
        return response

    def create_repository(self, name: str, private: bool = True) -> dict[str, Any]:
        _validate_repo_name(name)
        owner_path = f"/orgs/{self.org}/repos" if self.org else "/user/repos"
        response = self._request("POST", owner_path, json={"name": name, "private": private, "auto_init": True})
        return response.json()

    def create_branch(self, repo: str, new_branch: str, base: str = "main") -> dict[str, Any]:
        _validate_repo_name(repo)
        full_repo = f"{self.org}/{repo}" if self.org else repo
        base_ref = self._request("GET", f"/repos/{full_repo}/git/ref/heads/{base}").json()
        sha = base_ref["object"]["sha"]
        response = self._request(
            "POST",
            f"/repos/{full_repo}/git/refs",
            json={"ref": f"refs/heads/{new_branch}", "sha": sha},
        )
        return response.json()

    def create_or_update_file(self, repo: str, path: str, content: str, message: str, branch: str = "main") -> dict[str, Any]:
        _validate_repo_name(repo)
        import base64

        full_repo = f"{self.org}/{repo}" if self.org else repo
        encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")
        response = self._request(
            "PUT",
            f"/repos/{full_repo}/contents/{path}",
            json={"message": message, "content": encoded, "branch": branch},
        )
        return response.json()

    def create_pull_request(self, repo: str, title: str, head: str, base: str, body: str = "") -> dict[str, Any]:
        _validate_repo_name(repo)
        full_repo = f"{self.org}/{repo}" if self.org else repo
        response = self._request(
            "POST",
            f"/repos/{full_repo}/pulls",
            json={"title": title, "head": head, "base": base, "body": body},
        )
        return response.json()

    def merge_pull_request(self, repo: str, pr_number: int) -> dict[str, Any]:
        _validate_repo_name(repo)
        full_repo = f"{self.org}/{repo}" if self.org else repo
        response = self._request("PUT", f"/repos/{full_repo}/pulls/{pr_number}/merge")
        return response.json()

    def create_issue(self, repo: str, title: str, body: str, labels: list[str] | None = None) -> dict[str, Any]:
        _validate_repo_name(repo)
        full_repo = f"{self.org}/{repo}" if self.org else repo
        response = self._request(
            "POST",
            f"/repos/{full_repo}/issues",
            json={"title": title, "body": body, "labels": labels or []},
        )
        return response.json()

    def apply_push_mode(self, repo: str, push_mode: str, title: str, body: str, head: str, base: str = "main") -> dict[str, Any]:
        """Open a PR and, only under auto-push, merge it immediately."""
        pr = self.create_pull_request(repo, title=title, head=head, base=base, body=body)
        result = {"pull_request": pr, "merged": False}
        if push_mode == "auto_push":
            merge_result = self.merge_pull_request(repo, pr["number"])
            result["merged"] = True
            result["merge_result"] = merge_result
        return result
