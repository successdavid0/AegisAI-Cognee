"""Reset the demo: delete the SQLite DB and re-seed from scratch.

Usage (from backend/):  python scripts/reset_demo.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import settings  # noqa: E402
from scripts.seed_database import main as seed  # noqa: E402


def main() -> None:
    url = settings.database_url
    if url.startswith("sqlite:///"):
        db_path = Path(url.replace("sqlite:///", "")).resolve()
        if db_path.exists():
            db_path.unlink()
            print(f"Removed {db_path.name}")
    seed()


if __name__ == "__main__":
    main()
