"""Pure inventory-sync engine: readers → match → combine → quality gate.

No web, database, or vendor-SDK dependencies live here, so the core logic is
trivially testable and reusable across destinations.
"""

from .combine import combine_quantity
from .match import MatchResult, match_by_sku
from .models import (
    GradedItem,
    ItemStatus,
    MatchedItem,
    Pool,
    SourceItem,
)
from .pipeline import PreviewResult, RunSummary, run_preview
from .quality import (
    QualityThresholds,
    grade_matched,
    regrade_quantity,
)
from .readers import ExcelReader, ShopifyReader

__all__ = [
    "combine_quantity",
    "match_by_sku",
    "MatchResult",
    "GradedItem",
    "ItemStatus",
    "MatchedItem",
    "Pool",
    "SourceItem",
    "PreviewResult",
    "RunSummary",
    "run_preview",
    "QualityThresholds",
    "grade_matched",
    "regrade_quantity",
    "ExcelReader",
    "ShopifyReader",
]
