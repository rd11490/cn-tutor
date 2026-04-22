"""
Reads all cards from the Chinese Vocabulary Anki deck via AnkiConnect,
categorizes them by confidence level, and writes progress/anki-snapshot.md.

Usage:
    python scripts/get-learned-words.py
"""
import os
import sys
from datetime import date

import requests
from dotenv import load_dotenv

load_dotenv()

ANKI_URL = os.getenv("ANKI_CONNECT_URL", "http://localhost:8765")
DECK = "Chinese Vocabulary"
SNAPSHOT_PATH = os.path.join(os.path.dirname(__file__), "..", "progress", "anki-snapshot.md")

CONFIDENT_INTERVAL = 21
CONFIDENT_EASE = 2.5
LEARNING_INTERVAL = 7
LEARNING_EASE = 2.0


def _invoke(action, **params):
    resp = requests.post(ANKI_URL, json={"action": action, "version": 6, "params": params})
    resp.raise_for_status()
    result = resp.json()
    if result.get("error"):
        raise RuntimeError(f"AnkiConnect error: {result['error']}")
    return result["result"]


def get_all_cards():
    card_ids = _invoke("findCards", query=f'deck:"{DECK}"')
    if not card_ids:
        return []
    return _invoke("cardsInfo", cards=card_ids)


def categorize(card):
    interval = card.get("interval", 0)
    factor = card.get("factor", 0)
    ease = factor / 1000 if factor else 0.0
    if interval >= CONFIDENT_INTERVAL and ease >= CONFIDENT_EASE:
        return "confident"
    elif interval < LEARNING_INTERVAL or ease < LEARNING_EASE:
        return "shaky"
    return "learning"


def main():
    print(f"Fetching cards from '{DECK}'...")
    cards = get_all_cards()
    print(f"Found {len(cards)} cards.")

    confident, learning, shaky = [], [], []
    skipped_new = 0
    for card in cards:
        word = card.get("fields", {}).get("Simplified", {}).get("value", "").strip()
        if not word:
            continue
        if card.get("reps", 0) == 0:
            skipped_new += 1
            continue
        cat = categorize(card)
        if cat == "confident":
            confident.append(word)
        elif cat == "learning":
            learning.append(word)
        else:
            shaky.append(word)

    confident.sort()
    learning.sort()
    shaky.sort()

    print(f"Skipped {skipped_new} never-reviewed cards.")

    today = date.today().isoformat()
    total = len(confident) + len(learning) + len(shaky)

    top_learning = learning[:20]
    top_shaky = shaky[:10]
    personalization = (
        f"I'm learning Mandarin. I know ~{len(confident)} words confidently in Anki. "
        f"Currently learning: {', '.join(top_learning) if top_learning else 'n/a'}. "
        f"Shaky (need review): {', '.join(top_shaky) if top_shaky else 'n/a'}."
    )

    lines = [
        f"# Anki Vocab Snapshot — {today}",
        "",
        f"**Total reviewed:** {total} | **Confident:** {len(confident)} | **Learning:** {len(learning)} | **Shaky:** {len(shaky)} | **Never reviewed (excluded):** {skipped_new}",
        "",
        f"## Confident (interval ≥{CONFIDENT_INTERVAL}d, ease ≥{CONFIDENT_EASE})",
        "",
        ", ".join(confident) if confident else "_none yet_",
        "",
        "## Learning",
        "",
        ", ".join(learning) if learning else "_none yet_",
        "",
        "## Shaky (review soon)",
        "",
        ", ".join(shaky) if shaky else "_none yet_",
        "",
        "---",
        "",
        "_Claude Personalization Block (paste monthly):_",
        "",
        f"> {personalization}",
        "",
    ]

    snapshot = "\n".join(lines)
    os.makedirs(os.path.dirname(SNAPSHOT_PATH), exist_ok=True)
    with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
        f.write(snapshot)

    print(f"\nSnapshot written to: {SNAPSHOT_PATH}")
    print("\n" + "=" * 60)
    print("CLAUDE PERSONALIZATION BLOCK:")
    print("=" * 60)
    print(personalization)
    print("=" * 60)


if __name__ == "__main__":
    main()
