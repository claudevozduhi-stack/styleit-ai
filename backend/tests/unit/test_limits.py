"""Проверки суточного лимита бесплатных капсул."""

import uuid
from datetime import date

import pytest

from app.services.limits import DailyLimiter, DailyLimitExceededError, InvalidClientIdError

CLIENT = str(uuid.uuid4())
DAY = date(2026, 11, 25)


def test_consume_until_limit() -> None:
    limiter = DailyLimiter(per_day=2)
    assert limiter.consume(CLIENT, DAY) == 1
    assert limiter.consume(CLIENT, DAY) == 0
    with pytest.raises(DailyLimitExceededError):
        limiter.consume(CLIENT, DAY)


def test_refund_returns_generation() -> None:
    limiter = DailyLimiter(per_day=1)
    limiter.consume(CLIENT, DAY)
    limiter.refund(CLIENT, DAY)
    assert limiter.consume(CLIENT, DAY) == 0


def test_counter_resets_next_day() -> None:
    limiter = DailyLimiter(per_day=1)
    limiter.consume(CLIENT, DAY)
    assert limiter.consume(CLIENT, date(2026, 11, 26)) == 0


def test_clients_are_independent() -> None:
    limiter = DailyLimiter(per_day=1)
    limiter.consume(CLIENT, DAY)
    assert limiter.consume(str(uuid.uuid4()), DAY) == 0


@pytest.mark.parametrize("bad", [None, "", "user@example.com", "123"])
def test_invalid_client_id(bad: str | None) -> None:
    with pytest.raises(InvalidClientIdError):
        DailyLimiter(per_day=1).consume(bad, DAY)
