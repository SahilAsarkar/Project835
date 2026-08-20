"""Persistence and validation for editable MIR mapping configuration."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import config
from mapping_defaults import defaults

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
CONFIG_PATH = DATA_DIR / "mapping_config.json"

ALLOWED_MAP_TYPES = {"Direct from 835", "Formula", "Hardcoded Text", "System / Runtime", "Blank"}
ALLOWED_SOURCES = {
    "CLP01","CLP02","CLP03","CLP04","CLP05","CLP07","CLP08","CLP09",
    "NM1[QC].NM103","NM1[QC].NM104","NM1[QC].NM105","NM1[IL,MI].NM109",
    "REF[1L].REF02","DTM[036].DTM02","DTM[050].DTM02",
    "SVC01","SVC02","SVC03","SVC05","DTM[472].DTM02",
    "CAS.group","CAS.reason","CAS.amount",
}
ALLOWED_SYSTEM = {"PROCESS_DATE","RECORD_SEQUENCE","MAX_RECORD_SEQUENCE","SERVICE_COUNT"}


def _merge_saved(saved: list[dict[str, Any]]) -> list[dict[str, Any]]:
    base = defaults()
    by_id = {f["id"]: f for f in base}
    allowed_editable = {
        "mapType","map","length","start","upper","trim","truncate","align","pad",
        "fallbackType","fallbackValue","technicalRule",
    }
    for item in saved:
        target = by_id.get(item.get("id"))
        if not target:
            continue
        for key in allowed_editable:
            if key in item:
                target[key] = item[key]
        target["end"] = int(target["start"]) + int(target["length"]) - 1
    return base


def get_mappings() -> list[dict[str, Any]]:
    if not CONFIG_PATH.exists():
        return defaults()
    try:
        saved = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        if not isinstance(saved, list):
            return defaults()
        return _merge_saved(saved)
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return defaults()


def reset_mappings() -> list[dict[str, Any]]:
    if CONFIG_PATH.exists():
        CONFIG_PATH.unlink()
    return defaults()


def validate_mappings(fields: list[dict[str, Any]]) -> list[str]:
    issues: list[str] = []
    expected_ids = {f["id"] for f in defaults()}
    seen = set()
    by_scope: dict[str, list[tuple[int,int,str]]] = {"header": [], "service": []}

    for f in fields:
        fid = str(f.get("id", ""))
        if fid not in expected_ids:
            issues.append(f"Unknown MIR field: {fid or '(missing id)'}")
            continue
        if fid in seen:
            issues.append(f"Duplicate MIR field: {fid}")
        seen.add(fid)
        try:
            start = int(f.get("start", 0))
            length = int(f.get("length", 0))
        except (TypeError, ValueError):
            issues.append(f"{fid}: start/size must be numbers")
            continue
        if start < 1 or length < 1:
            issues.append(f"{fid}: invalid start/size")
            continue
        scope = f.get("scope")
        max_len = config.MIR_SERVICE_BLOCK_LENGTH if scope == "Service" else config.MIR_HEADER_LENGTH
        end = start + length - 1
        if end > max_len:
            issues.append(f"{fid}: position {start}-{end} exceeds {'service' if scope == 'Service' else 'header'} length {max_len}")
        bucket = "service" if scope == "Service" else "header"
        by_scope[bucket].append((start, end, fid))

        mt = f.get("mapType")
        mapping = str(f.get("map", ""))
        if mt not in ALLOWED_MAP_TYPES:
            issues.append(f"{fid}: unsupported mapping type {mt!r}")
        elif mt != "Blank" and mt != "Formula" and not mapping.strip():
            issues.append(f"{fid}: mapping/value is empty")
        elif mt == "Formula" and not str(f.get("technicalRule") or mapping).strip():
            issues.append(f"{fid}: formula is empty")
        elif mt == "Direct from 835" and mapping not in ALLOWED_SOURCES:
            issues.append(f"{fid}: unsupported 835 source {mapping!r}")
        elif mt == "System / Runtime" and mapping not in ALLOWED_SYSTEM:
            issues.append(f"{fid}: unsupported system value {mapping!r}")

        if f.get("align") not in {"left", "right"}:
            issues.append(f"{fid}: alignment must be left or right")
        pad = str(f.get("pad", " "))
        if len(pad) != 1:
            issues.append(f"{fid}: pad character must be one character")

    # Existing MIR fields intentionally have gaps, but configured fields must not overlap.
    for bucket, ranges in by_scope.items():
        ranges.sort()
        for (s1,e1,id1),(s2,e2,id2) in zip(ranges, ranges[1:]):
            if s2 <= e1:
                issues.append(f"{bucket}: {id1} ({s1}-{e1}) overlaps {id2} ({s2}-{e2})")

    return issues


def save_mappings(fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    base_by_id = {f["id"]: f for f in defaults()}
    normalized: list[dict[str, Any]] = []
    for incoming in fields:
        fid = incoming.get("id")
        if fid not in base_by_id:
            continue
        merged = deepcopy(base_by_id[fid])
        for key in ("mapType","map","length","start","upper","trim","truncate","align","pad","fallbackType","fallbackValue","technicalRule"):
            if key in incoming:
                merged[key] = incoming[key]
        if merged["mapType"] == "Formula" and not str(merged.get("technicalRule", "")).strip():
            merged["technicalRule"] = str(merged.get("map", "")).strip()
        merged["start"] = int(merged["start"])
        merged["length"] = int(merged["length"])
        merged["end"] = merged["start"] + merged["length"] - 1
        normalized.append(merged)

    issues = validate_mappings(normalized)
    if issues:
        raise ValueError("\n".join(issues))

    tmp = CONFIG_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(normalized, indent=2), encoding="utf-8")
    tmp.replace(CONFIG_PATH)
    return get_mappings()
