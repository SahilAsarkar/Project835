from pathlib import Path

import mapping_store
from converter import convert_835_to_mir


SAMPLE = "\n".join([
    "CLP*12345678901234567*1*100*80*20**PCN123*11*1",
    "NM1*QC*1*DOE*JANE*Q",
    "NM1*IL*1*DOE*JANE*Q***MI*MEMBER123456",
    "DTM*036*19900101",
    "SVC*HC:99214*100*80**1",
    "CAS*CO*45*20",
])


def test_saved_mapping_is_used_by_converter(tmp_path, monkeypatch):
    monkeypatch.setattr(mapping_store, "CONFIG_PATH", tmp_path / "mapping_config.json")
    baseline, _ = convert_835_to_mir(SAMPLE)
    assert baseline[:2] == "MO"

    fields = mapping_store.get_mappings()
    next(f for f in fields if f["id"] == "MIR000")["map"] = "ZZ"
    mapping_store.save_mappings(fields)

    changed, _ = convert_835_to_mir(SAMPLE)
    assert changed[:2] == "ZZ"
    assert changed != baseline

    mapping_store.reset_mappings()
    reset, _ = convert_835_to_mir(SAMPLE)
    assert reset == baseline


def test_default_group_fallback_still_applies(tmp_path, monkeypatch):
    monkeypatch.setattr(mapping_store, "CONFIG_PATH", tmp_path / "mapping_config.json")
    out, _ = convert_835_to_mir(SAMPLE)
    # MIR group field = 1-based positions 77-84.
    assert out[76:84] == "99999999"
