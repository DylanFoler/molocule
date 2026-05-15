"""
Web scraper for buying signal detection.
Uses feedparser for RSS and Playwright for JS-rendered pages.
"""

import re
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
import feedparser
import requests
from bs4 import BeautifulSoup
from llm import analyze_signal, SignalType

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Molocule-Signal-Bot/1.0 (+https://molocule.dev)"}
SIGNAL_API_URL = os.environ.get("NEXT_API_URL", "http://localhost:3000") + "/api/signals"
CRON_SECRET = os.environ["CRON_SECRET"]


def push_signal(
    company_id: str,
    company_name: str,
    signal_type: SignalType,
    title: str,
    url: Optional[str],
    summary: str,
) -> bool:
    """Push a detected signal to the Next.js API."""
    insight = analyze_signal(company_name, signal_type, title, summary)
    res = requests.post(
        SIGNAL_API_URL,
        json={
            "company_id": company_id,
            "type": signal_type,
            "title": title,
            "url": url,
            "summary": summary[:500],
            "llm_insight": insight,
        },
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
        timeout=15,
    )
    if res.ok:
        data = res.json()
        if data.get("skipped"):
            logger.debug("Skipped duplicate signal: %s", title)
            return False
        return True
    logger.warning("Failed to push signal: %s %s", res.status_code, res.text)
    return False


def classify_content(title: str, body: str) -> SignalType:
    text = (title + " " + body).lower()
    if re.search(r"\$[\d]+ ?m|series [a-d]|raised|funding|investment|venture capital", text):
        return "FUNDING"
    if re.search(r"layoff|laid off|reduction in force|workforce reduction|downsiz", text):
        return "LAYOFF"
    if re.search(r"\bhired\b|joins as|appoints|new cto|new ceo|new vp|head of|svp|evp", text):
        return "KEY_HIRE"
    if re.search(r"\blaunch(ed|es)?\b|announce[sd]?|new product|general availability|ga\b|ship", text):
        return "PRODUCT_LAUNCH"
    return "GENERAL"


def scan_rss_feed(company_id: str, company_name: str, rss_url: str) -> int:
    """Scan a company blog RSS feed for signals. Returns number of new signals pushed."""
    count = 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    try:
        feed = feedparser.parse(rss_url)
        for entry in feed.entries[:10]:
            pub_date = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                pub_date = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)

            if pub_date and pub_date < cutoff:
                continue

            title = entry.get("title", "").strip()
            url = entry.get("link", "")
            summary = BeautifulSoup(
                entry.get("summary", entry.get("description", "")), "lxml"
            ).get_text()[:600]

            if not title:
                continue

            signal_type = classify_content(title, summary)
            if push_signal(company_id, company_name, signal_type, title, url, summary):
                count += 1

    except Exception as e:
        logger.warning("RSS scan failed for %s (%s): %s", company_name, rss_url, e)

    return count


def scan_news_api(company_id: str, company_name: str) -> int:
    """
    Scan news via NewsAPI (requires NEWSAPI_KEY env var).
    Falls back gracefully if key not set.
    """
    api_key = os.environ.get("NEWSAPI_KEY")
    if not api_key:
        return 0

    count = 0
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": f'"{company_name}"',
        "sortBy": "publishedAt",
        "pageSize": 10,
        "language": "en",
        "from": (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d"),
        "apiKey": api_key,
    }

    try:
        res = requests.get(url, params=params, headers=HEADERS, timeout=10)
        res.raise_for_status()
        articles = res.json().get("articles", [])

        for article in articles:
            title = article.get("title", "").strip()
            desc = article.get("description", "") or ""
            art_url = article.get("url", "")

            if not title or "[Removed]" in title:
                continue

            signal_type = classify_content(title, desc)
            if push_signal(company_id, company_name, signal_type, title, art_url, desc):
                count += 1

    except Exception as e:
        logger.warning("NewsAPI scan failed for %s: %s", company_name, e)

    return count


def scan_company(company: dict) -> dict:
    """Run all scanners for a single company."""
    cid = company["id"]
    name = company["name"]
    total = 0

    if company.get("blog_rss_url"):
        total += scan_rss_feed(cid, name, company["blog_rss_url"])

    total += scan_news_api(cid, name)

    return {"company": name, "signals_found": total}
