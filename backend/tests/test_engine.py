"""End-to-end and unit tests for the pure engine.

These exercise the heart of the app: normalization, SKU matching across
sources, pool combination, and the quality gate's two flag tiers — without any
web or database layer.
"""

from __future__ import annotations

import pytest

from app.engine import (
    ExcelReader,
    ItemStatus,
    Pool,
    QualityThresholds,
    ShopifyReader,
    combine_quantity,
    grade_matched,
    match_by_sku,
    regrade_quantity,
    run_preview,
)
from app.engine.match import match_by_sku as _match


# --------------------------------------------------------------------------- #
# Readers
# --------------------------------------------------------------------------- #

def test_excel_reader_applies_column_map():
    reader = ExcelReader({"sku": "Code", "name": "Product", "quantity": "Qty"})
    rows = [
        {"Code": "ABC-1", "Product": "Blue Mug", "Qty": 30},
        {"Code": " abc-2 ", "Product": "Red Mug", "Qty": "12"},
    ]
    items = reader.read(rows)
    assert items[0].sku == "ABC-1"
    assert items[0].pool is Pool.OFFLINE
    assert items[0].quantity == 30
    # SKU is trimmed; string quantities parse.
    assert items[1].sku == "abc-2"
    assert items[1].quantity == 12


def test_excel_reader_rejects_bad_mapping():
    with pytest.raises(ValueError):
        ExcelReader({"sku": "Code"})  # missing name + quantity


def test_excel_reader_records_unparseable_quantity_as_none():
    reader = ExcelReader({"sku": "s", "name": "n", "quantity": "q"})
    items = reader.read([{"s": "X", "n": "Thing", "q": "twelve"}])
    assert items[0].quantity is None
    assert items[0].raw_quantity == "twelve"


def test_shopify_reader_normalizes_variants():
    reader = ShopifyReader()
    variants = [{"sku": "ABC-1", "title": "Blue Mug", "inventory_quantity": 50}]
    items = reader.read(variants)
    assert items[0].sku == "ABC-1"
    assert items[0].pool is Pool.ONLINE
    assert items[0].quantity == 50


def test_float_quantity_with_fraction_is_unparseable():
    reader = ExcelReader({"sku": "s", "name": "n", "quantity": "q"})
    assert reader.read([{"s": "X", "n": "T", "q": 30.5}])[0].quantity is None
    assert reader.read([{"s": "X", "n": "T", "q": 30.0}])[0].quantity == 30


# --------------------------------------------------------------------------- #
# Match
# --------------------------------------------------------------------------- #

def _excel(items):
    return ExcelReader({"sku": "sku", "name": "name", "quantity": "qty"}).read(items)


def _shopify(items):
    return ShopifyReader(sku_key="sku", name_key="name", quantity_key="qty").read(items)


def test_match_pairs_same_sku_case_insensitively():
    online = _shopify([{"sku": "abc-1", "name": "Mug", "qty": 50}])
    offline = _excel([{"sku": "ABC-1", "name": "Mug", "qty": 30}])
    result = _match(online, offline)
    assert len(result.items) == 1
    item = result.items[0]
    assert item.online_qty == 50
    assert item.offline_qty == 30


def test_match_keeps_single_source_skus():
    online = _shopify([{"sku": "ONLY-ON", "name": "X", "qty": 5}])
    offline = _excel([{"sku": "ONLY-OFF", "name": "Y", "qty": 7}])
    result = _match(online, offline)
    skus = {i.sku for i in result.items}
    assert skus == {"ONLY-ON", "ONLY-OFF"}


def test_match_flags_duplicate_within_source():
    offline = _excel(
        [
            {"sku": "DUP", "name": "A", "qty": 1},
            {"sku": "DUP", "name": "A", "qty": 2},
        ]
    )
    result = _match([], offline)
    assert "DUP" in result.duplicate_skus
    assert len(result.duplicate_skus["DUP"]) == 1


def test_match_collects_missing_skus():
    offline = _excel([{"sku": "", "name": "No SKU", "qty": 3}])
    result = _match([], offline)
    assert len(result.missing_skus) == 1
    assert result.items == []


# --------------------------------------------------------------------------- #
# Combine
# --------------------------------------------------------------------------- #

def test_combine_adds_separate_pools():
    online = _shopify([{"sku": "X", "name": "X", "qty": 50}])
    offline = _excel([{"sku": "X", "name": "X", "qty": 30}])
    matched = _match(online, offline).items[0]
    assert combine_quantity(matched) == 80


def test_combine_treats_absent_pool_as_zero():
    online = _shopify([{"sku": "X", "name": "X", "qty": 50}])
    matched = _match(online, []).items[0]
    assert combine_quantity(matched) == 50


def test_combine_returns_none_when_present_pool_unreadable():
    online = _shopify([{"sku": "X", "name": "X", "qty": "oops"}])
    offline = _excel([{"sku": "X", "name": "X", "qty": 30}])
    matched = _match(online, offline).items[0]
    assert combine_quantity(matched) is None  # do not invent stock we can't read


# --------------------------------------------------------------------------- #
# Quality gate
# --------------------------------------------------------------------------- #

def _matched_single(sku="X", name="Thing", online=None, offline=None):
    online_list = _shopify([{"sku": sku, "name": name, "qty": online}]) if online is not None else []
    offline_list = _excel([{"sku": sku, "name": name, "qty": offline}]) if offline is not None else []
    return _match(online_list, offline_list).items[0]


def test_clean_item_passes():
    matched = _matched_single(online=50, offline=30)
    graded = grade_matched(matched, thresholds=QualityThresholds.defaults())
    assert graded.status is ItemStatus.CLEAN
    assert graded.combined_qty == 80
    assert graded.final_quantity == 80
    assert graded.reasons == []


def test_negative_quantity_is_hard_flag():
    matched = _matched_single(online=-5)
    graded = grade_matched(matched, thresholds=QualityThresholds.defaults())
    assert graded.status is ItemStatus.FLAGGED_HARD
    assert any("negative" in r.lower() for r in graded.reasons)


def test_unreadable_quantity_is_hard_flag_naming_source():
    matched = _matched_single(online="bogus", offline=30)
    graded = grade_matched(matched, thresholds=QualityThresholds.defaults())
    assert graded.status is ItemStatus.FLAGGED_HARD
    assert any("online" in r.lower() for r in graded.reasons)


def test_too_large_is_suspicious():
    thresholds = QualityThresholds(max_quantity=100)
    matched = _matched_single(online=999)
    graded = grade_matched(matched, thresholds=thresholds)
    assert graded.status is ItemStatus.FLAGGED_SUSPICIOUS
    assert any("too large" in r.lower() for r in graded.reasons)


def test_big_swing_pct_is_suspicious():
    thresholds = QualityThresholds(max_quantity=None, max_swing_pct=0.5)
    matched = _matched_single(online=100)  # combined 100
    graded = grade_matched(
        matched, thresholds=thresholds, last_sync_quantities={"X": 10}
    )
    assert graded.status is ItemStatus.FLAGGED_SUSPICIOUS
    assert any("since last sync" in r for r in graded.reasons)


def test_big_swing_abs_is_suspicious():
    thresholds = QualityThresholds(max_quantity=None, max_swing_abs=50)
    matched = _matched_single(online=100)
    graded = grade_matched(
        matched, thresholds=thresholds, last_sync_quantities={"X": 10}
    )
    assert graded.status is ItemStatus.FLAGGED_SUSPICIOUS


def test_small_swing_within_threshold_stays_clean():
    thresholds = QualityThresholds(max_quantity=None, max_swing_pct=0.5)
    matched = _matched_single(online=11)
    graded = grade_matched(
        matched, thresholds=thresholds, last_sync_quantities={"X": 10}
    )
    assert graded.status is ItemStatus.CLEAN


def test_missing_name_flag_can_be_disabled():
    matched = _matched_single(name="", online=5)
    on = grade_matched(matched, thresholds=QualityThresholds(flag_missing_name=True))
    assert on.status is ItemStatus.FLAGGED_SUSPICIOUS
    matched2 = _matched_single(name="", online=5)
    off = grade_matched(matched2, thresholds=QualityThresholds(flag_missing_name=False))
    assert off.status is ItemStatus.CLEAN


# --------------------------------------------------------------------------- #
# Re-check after fix
# --------------------------------------------------------------------------- #

def test_regrade_clears_a_fixed_item():
    thresholds = QualityThresholds(max_quantity=100)
    matched = _matched_single(online=999)
    graded = grade_matched(matched, thresholds=thresholds)
    assert graded.status is ItemStatus.FLAGGED_SUSPICIOUS
    fixed = regrade_quantity(graded, 50, thresholds=thresholds)
    assert fixed.status is ItemStatus.FIXED
    assert fixed.final_quantity == 50
    assert fixed.reasons == []


def test_regrade_keeps_still_bad_item_flagged():
    thresholds = QualityThresholds(max_quantity=100)
    matched = _matched_single(online=999)
    graded = grade_matched(matched, thresholds=thresholds)
    still_bad = regrade_quantity(graded, 500, thresholds=thresholds)
    assert still_bad.status is ItemStatus.FLAGGED_SUSPICIOUS
    assert still_bad.final_quantity == 500


# --------------------------------------------------------------------------- #
# Full pipeline
# --------------------------------------------------------------------------- #

def test_run_preview_end_to_end():
    online = _shopify(
        [
            {"sku": "MUG", "name": "Mug", "qty": 50},
            {"sku": "PEN", "name": "Pen", "qty": 999999},   # too large
            {"sku": "BAD", "name": "Bad", "qty": "x"},       # unreadable
        ]
    )
    offline = _excel(
        [
            {"sku": "MUG", "name": "Mug", "qty": 30},   # combines to 80, clean
            {"sku": "BOX", "name": "Box", "qty": -3},   # negative, hard
            {"sku": "", "name": "Orphan", "qty": 1},    # missing sku, hard
        ]
    )
    result = run_preview(
        online_items=online,
        offline_items=offline,
        thresholds=QualityThresholds(max_quantity=10_000),
    )
    by_sku = {i.sku: i for i in result.items if i.sku}
    assert by_sku["MUG"].status is ItemStatus.CLEAN
    assert by_sku["MUG"].combined_qty == 80
    assert by_sku["PEN"].status is ItemStatus.FLAGGED_SUSPICIOUS
    assert by_sku["BAD"].status is ItemStatus.FLAGGED_HARD
    assert by_sku["BOX"].status is ItemStatus.FLAGGED_HARD

    s = result.summary
    assert s.total == 5
    assert s.clean == 1
    assert s.flagged_hard == 3   # BAD, BOX, orphan
    assert s.flagged_suspicious == 1
    assert s.flagged == 4


def test_run_preview_uses_defaults_when_no_thresholds():
    online = _shopify([{"sku": "A", "name": "A", "qty": 5}])
    result = run_preview(online_items=online, offline_items=[])
    assert result.summary.clean == 1
