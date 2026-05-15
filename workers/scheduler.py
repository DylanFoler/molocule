"""
Main scheduler for Molocule workers.
Run: python scheduler.py

Or triggered directly by GitHub Actions via HTTP.
"""

import os
import logging
import sys
from datetime import datetime
import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("scheduler")

NEXT_API_URL = os.environ.get("NEXT_API_URL", "http://localhost:3000")
CRON_SECRET = os.environ["CRON_SECRET"]

AUTH_HEADERS = {"Authorization": f"Bearer {CRON_SECRET}", "Content-Type": "application/json"}


def run_signal_scan() -> None:
    """Trigger the nightly signal scanner via the Next.js cron endpoint."""
    logger.info("Starting signal scan...")
    try:
        res = requests.post(
            f"{NEXT_API_URL}/api/cron/scan",
            headers=AUTH_HEADERS,
            timeout=300,
        )
        if res.ok:
            data = res.json()
            logger.info(
                "Signal scan complete: %d companies scanned, results: %s",
                data.get("scanned", 0),
                data.get("results", []),
            )
        else:
            logger.error("Signal scan failed: %s %s", res.status_code, res.text)
    except Exception as e:
        logger.error("Signal scan error: %s", e)


def run_pr_digests() -> None:
    """Fetch all repos from the API and generate weekly digests."""
    logger.info("Starting PR digest generation...")

    from github_processor import generate_and_post_digest

    # Fetch all repos from Next.js API (internal call)
    try:
        res = requests.get(
            f"{NEXT_API_URL}/api/repos",
            headers=AUTH_HEADERS,
            timeout=30,
        )
        if not res.ok:
            logger.error("Failed to fetch repos: %s", res.text)
            return

        repos = res.json()
        logger.info("Processing %d repos...", len(repos))

        for repo in repos:
            try:
                generate_and_post_digest(repo, days=7)
            except Exception as e:
                logger.error("Digest error for %s: %s", repo.get("full_name"), e)

    except Exception as e:
        logger.error("PR digest run error: %s", e)


def run_all() -> None:
    """Run all jobs immediately (used by GitHub Actions)."""
    logger.info("=== Running all Molocule jobs at %s ===", datetime.now().isoformat())
    run_signal_scan()
    run_pr_digests()
    logger.info("=== All jobs complete ===")


if __name__ == "__main__":
    if "--run-now" in sys.argv:
        run_all()
        sys.exit(0)

    scheduler = BlockingScheduler(timezone="UTC")

    # Signal scan: nightly at 06:00 UTC
    scheduler.add_job(run_signal_scan, CronTrigger(hour=6, minute=0), id="signal_scan", name="Nightly Signal Scan")

    # PR digests: every Sunday at 08:00 UTC
    scheduler.add_job(run_pr_digests, CronTrigger(day_of_week="sun", hour=8, minute=0), id="pr_digests", name="Weekly PR Digests")

    logger.info("Scheduler started. Jobs: signal scan @ 06:00 UTC daily, PR digests @ Sunday 08:00 UTC")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")
