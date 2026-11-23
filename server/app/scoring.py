"""Scoring.

Scores are always computed here, on the server, and stored in the `scores`
table with a method name and formula version. If a formula changes, bump its
version and recompute old runs with `python -m app.cli rescore`.

The test form is 60 real and 30 pseudo items (team decision, 2026-11-23).
On such a 2:1 form the three scores below are linear transforms of each other
(lextale_avg = 50 + ghent_norm / 2), so they rank participants identically;
they are all stored so results can be compared with LexTALE, LEXTALE_CH and
LexCHI. The main reported score is lextale_avg (team decision, 2026-11-23).
"""

from dataclasses import dataclass
from typing import Any

from .models import ItemRole, Lexicality, Response, Trial


@dataclass(frozen=True)
class ScoreResult:
    method: str
    formula_version: int
    value: float
    details: dict[str, Any]


def _counts(trials: list[Trial]) -> dict[Lexicality, list[int]]:
    """[correct, total] per lexicality, over test items only; unanswered counts as incorrect."""
    counts = {Lexicality.real: [0, 0], Lexicality.pseudo: [0, 0]}
    for t in trials:
        if t.role != ItemRole.test:
            continue
        c = counts[t.item.lexicality]
        c[1] += 1
        if t.is_correct:
            c[0] += 1
    return counts


def lextale_average(trials: list[Trial]) -> ScoreResult:
    """Mean of percent correct on real items and percent correct on pseudo items.

    This is the averaged score described for the original LexTALE
    (Lemhoefer & Broersma, 2012, https://doi.org/10.3758/s13428-011-0146-0):
    ((real correct / real total) * 100 + (pseudo correct / pseudo total) * 100) / 2.

    Only test items count; practice items are ignored. Unanswered test items
    count as incorrect, so the denominator is the number of planned items.
    """
    counts = _counts(trials)

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


def _ghent_details(trials: list[Trial]) -> tuple[int, int, dict[str, Any]]:
    counts = _counts(trials)
    hits, real_total = counts[Lexicality.real]
    correct_rejections, pseudo_total = counts[Lexicality.pseudo]
    # A pseudo item counts as a false alarm only if it was answered "yes";
    # unanswered pseudo items are neither a hit nor a false alarm here.
    false_alarms = sum(
        1
        for t in trials
        if t.role == ItemRole.test and t.item.lexicality == Lexicality.pseudo and t.response == Response.yes
    )
    details = {
        "hits": hits,
        "real_total": real_total,
        "false_alarms": false_alarms,
        "correct_rejections": correct_rejections,
        "pseudo_total": pseudo_total,
    }
    return hits - 2 * false_alarms, real_total, details


def ghent_score(trials: list[Trial]) -> ScoreResult:
    """Corrected accuracy: hits - 2 x false alarms.

    LEXTALE_CH (Chan & Chang, 2018, equation 2), "Corrected Accuracy"; the same
    formula as the Ghent score used for LexCHI (Wen et al., 2023,
    https://doi.org/10.3758/s13428-023-02151-z). The factor 2 matches a form
    with twice as many real as pseudo items. Range on a 60/30 form: -60 to 60.
    """
    value, _, details = _ghent_details(trials)
    return ScoreResult(method="ghent", formula_version=1, value=float(value), details=details)


def ghent_normalised(trials: list[Trial]) -> ScoreResult:
    """Normalised Ghent score: 100 x (hits - 2 x false alarms) / number of real items.

    Wen et al. (2023), section "Introducing the normalised Ghent score"; range -100 to 100.
    """
    value, real_total, details = _ghent_details(trials)
    norm = 100.0 * value / real_total if real_total else 0.0
    return ScoreResult(method="ghent_norm", formula_version=1, value=round(norm, 4), details=details)


SCORERS = [lextale_average, ghent_score, ghent_normalised]


def score_trials(trials: list[Trial]) -> list[ScoreResult]:
    return [f(trials) for f in SCORERS]
