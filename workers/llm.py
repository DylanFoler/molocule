import anthropic
import os
from typing import Literal

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SignalType = Literal["FUNDING", "KEY_HIRE", "LAYOFF", "PRODUCT_LAUNCH", "GENERAL"]

TYPE_CONTEXT: dict[str, str] = {
    "FUNDING": "a funding announcement",
    "KEY_HIRE": "a key executive hire",
    "LAYOFF": "a layoff announcement",
    "PRODUCT_LAUNCH": "a product launch",
    "GENERAL": "a company update",
}


def analyze_signal(company_name: str, signal_type: SignalType, title: str, summary: str) -> str:
    """Generate a one-line GTM insight for a detected signal."""
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=150,
        messages=[
            {
                "role": "user",
                "content": (
                    f"You are a GTM analyst writing micro-insights for sales and marketing teams.\n\n"
                    f"Company: {company_name}\n"
                    f"Signal: {TYPE_CONTEXT.get(signal_type, 'an update')}\n"
                    f"Title: {title}\n"
                    f"Context: {summary[:400]}\n\n"
                    "Write ONE sharp sentence (max 20 words) explaining why this signal matters "
                    "for a sales rep. Be specific about the buying opportunity or risk. No fluff."
                ),
            }
        ],
    )
    content = message.content[0]
    if content.type == "text":
        return content.text.strip()
    return "Signal detected — review for sales opportunity."


def summarize_pr_digest(
    repo_full_name: str,
    prs: list[dict],
    workflow_runs: list[dict],
    period_start: str,
    period_end: str,
) -> str:
    """Generate an executive summary for a batch of PRs."""
    pr_list = "\n".join(
        f"- [{pr.get('state', '').upper()}] #{pr.get('number')}: {pr.get('title')} (by @{pr.get('author', 'unknown')})"
        for pr in prs[:20]
    )
    workflow_summary = "\n".join(
        f"- {w.get('name')}: {w.get('conclusion') or w.get('status')}"
        for w in workflow_runs[:10]
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[
            {
                "role": "user",
                "content": (
                    f"You are a senior engineering lead writing a weekly digest for stakeholders.\n\n"
                    f"Repository: {repo_full_name}\n"
                    f"Period: {period_start} to {period_end}\n\n"
                    f"Pull Requests ({len(prs)} total):\n{pr_list}\n\n"
                    f"CI/CD Workflow Runs:\n{workflow_summary}\n\n"
                    "Write a concise executive summary (3-4 sentences) covering: what shipped, "
                    "engineering health, and any blockers or risks. Be direct and technical."
                ),
            }
        ],
    )
    content = message.content[0]
    return content.text.strip() if content.type == "text" else "Digest generated. Review PRs for details."
