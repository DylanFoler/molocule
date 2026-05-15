"""
GitHub PR processor — fetches PR and workflow data,
generates digest via Claude, and posts to the API.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
import requests
from github import Github, GithubException
from llm import summarize_pr_digest

logger = logging.getLogger(__name__)

NEXT_API_URL = os.environ.get("NEXT_API_URL", "http://localhost:3000")
CRON_SECRET = os.environ["CRON_SECRET"]
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")


def get_repo_prs(owner: str, name: str, since: datetime) -> list[dict]:
    g = Github(GITHUB_TOKEN)
    try:
        repo = g.get_repo(f"{owner}/{name}")
        pulls = repo.get_pulls(state="all", sort="updated", direction="desc")
        result = []
        for pr in pulls:
            if pr.updated_at.replace(tzinfo=timezone.utc) < since.replace(tzinfo=timezone.utc):
                break
            result.append({
                "number": pr.number,
                "title": pr.title,
                "author": pr.user.login if pr.user else "unknown",
                "state": "merged" if pr.merged_at else pr.state,
                "url": pr.html_url,
                "merged_at": pr.merged_at.isoformat() if pr.merged_at else None,
                "created_at": pr.created_at.isoformat(),
                "labels": [l.name for l in pr.labels],
                "body": (pr.body or "")[:500],
            })
            if len(result) >= 50:
                break
        return result
    except GithubException as e:
        logger.error("GitHub PRs error for %s/%s: %s", owner, name, e)
        return []


def get_workflow_runs(owner: str, name: str, since: datetime) -> list[dict]:
    g = Github(GITHUB_TOKEN)
    try:
        repo = g.get_repo(f"{owner}/{name}")
        runs = repo.get_workflow_runs(created=f">={since.strftime('%Y-%m-%d')}")
        result = []
        for run in runs:
            result.append({
                "id": run.id,
                "name": run.name,
                "status": run.status,
                "conclusion": run.conclusion,
                "created_at": run.created_at.isoformat(),
                "html_url": run.html_url,
            })
            if len(result) >= 30:
                break
        return result
    except GithubException as e:
        logger.error("GitHub workflows error for %s/%s: %s", owner, name, e)
        return []


def generate_and_post_digest(repo: dict, days: int = 7) -> bool:
    """Generate a digest for a repo and POST it to the Next.js API."""
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=days)

    prs = get_repo_prs(repo["owner"], repo["name"], period_start)
    workflow_runs = get_workflow_runs(repo["owner"], repo["name"], period_start)

    if not prs and not workflow_runs:
        logger.info("No activity for %s in last %d days — skipping digest", repo["full_name"], days)
        return False

    summary = summarize_pr_digest(
        repo_full_name=repo["full_name"],
        prs=prs,
        workflow_runs=workflow_runs,
        period_start=period_start.strftime("%b %d"),
        period_end=period_end.strftime("%b %d, %Y"),
    )

    merged = [p for p in prs if p["state"] == "merged"]
    contributors = list({p["author"] for p in prs})

    payload = {
        "repo_id": repo["id"],
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "summary": summary,
        "pr_count": len(prs),
        "merged_count": len(merged),
        "open_count": len([p for p in prs if p["state"] == "open"]),
        "raw_data": {
            "prs": prs,
            "workflow_runs": workflow_runs,
            "contributors": contributors,
            "key_changes": [],
        },
    }

    res = requests.post(
        f"{NEXT_API_URL}/api/reports",
        json=payload,
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
        timeout=30,
    )

    if res.ok:
        logger.info("Digest created for %s", repo["full_name"])
        return True

    logger.error("Failed to post digest for %s: %s", repo["full_name"], res.text)
    return False
