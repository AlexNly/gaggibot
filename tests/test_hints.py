from matebot.hints import make_hint


def test_good_shot_no_hint():
    assert make_hint({"rating": 4, "balanceTaste": "balanced"}) is None
    assert make_hint({"rating": 5}) is None
    assert make_hint({}) is None


def test_sour_suggests_finer_and_credits():
    hint = make_hint({"rating": 3, "balanceTaste": "sour", "grindSetting": "1 - 0.2"})
    assert "under-extraction" in hint
    assert "finer" in hint
    assert "1 - 0.2" in hint
    assert "modsmthng" in hint


def test_sour_with_short_ratio_mentions_ratio():
    hint = make_hint({"balanceTaste": "sour", "ratio": "1.60", "rating": 3})
    assert "1:1.60" in hint and "lengthen" in hint


def test_bitter_suggests_coarser():
    hint = make_hint({"balanceTaste": "bitter", "ratio": "2.50", "rating": 3})
    assert "over-extraction" in hint
    assert "coarser" in hint
    assert "shorten" in hint and "1:2.50" in hint


def test_low_rating_without_taste_generic():
    hint = make_hint({"rating": 2})
    assert "one variable at a time" in hint.lower()
    assert "modsmthng" in hint


def test_bad_ratio_string_tolerated():
    hint = make_hint({"balanceTaste": "sour", "ratio": "n/a", "rating": 1})
    assert "finer" in hint
