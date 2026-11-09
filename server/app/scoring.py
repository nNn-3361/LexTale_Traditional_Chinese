"""Scoring.

Scores are always computed here, on the server, and stored in the `scores`
table with a method name and formula version. If a formula changes, bump its
version and recompute old runs with `python -m app.cli rescore`.

Only one method is implemented for now. Which method the final test uses will
be decided from the pilot data (see the research proposal, section 5.6).
"""

from dataclasses import dataclass
from typing import Any

from .models import ItemRole, Lexicality, Trial


@dataclass(frozen=True)
class ScoreResult:
    method: str
    formula_version: int
    value: float
    details: dict[str, Any]


def lextale_average(trials: list[Trial]) -> ScoreResult:
    """Mean of percent correct on real items and percent correct on pseudo items.

    This is the averaged score described for the original LexTALE
    (Lemhoefer & Broersma, 2012, https://doi.org/10.3758/s13428-011-0146-0):
    ((real correct / real total) * 100 + (pseudo correct / pseudo total) * 100) / 2.

    Only test items count; practice items are ignored. Unanswered test items
    count as incorrect, so the denominator is the number of planned items.
    """
    counts = {Lexicality.real: [0, 0], Lexicality.pseudo: [0, 0]}  # [correct, total]
    for t in trials:
        if t.role != ItemRole.test:
            continue
        c = counts[t.item.lexicality]
        c[1] += 1
        if t.is_correct:
            c[0] += 1

    def pct(c: list[int]) -> float:
        return 100.0 * c[0] / c[1] if c[1] else 0.0

    real_pct = pct(counts[Lexicality.real])
    pseudo_pct = pct(counts[Lexicality.pseudo])
    return ScoreResult(
        method="lextale_avg",
        formula_version=1,
        value=round((real_pct + pseudo_pct) / 2, 4),
        details={
            "real_correct": counts[Lexicality.real][0],
            "real_total": counts[Lexicality.real][1],
            "pseudo_correct": counts[Lexicality.pseudo][0],
            "pseudo_total": counts[Lexicality.pseudo][1],
            "answered": sum(1 for t in trials if t.role == ItemRole.test and t.response),
        },
    )


SCORERS = [lextale_average]


def score_trials(trials: list[Trial]) -> list[ScoreResult]:
    return [f(trials) for f in SCORERS]
