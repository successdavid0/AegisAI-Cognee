"""Shared slowapi rate limiter (keyed by client IP).

Defined in its own module so route modules can import the decorator without a
circular import back to main. Registered on the app + given a 429 handler in
main.py. Limits come from settings.rate_limit (env-tunable).
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
