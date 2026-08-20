"""Minimal, tolerant X12 835 parser for fields needed by the MIR generator."""
from decimal import Decimal, InvalidOperation
from typing import Iterable, List

import config
from models import Adjustment, Claim, ServiceLine


def _decimal(value: str, default: str = "0") -> Decimal:
    try:
        return Decimal((value or default).strip())
    except (InvalidOperation, ValueError):
        return Decimal(default)


def _segments(text: str) -> Iterable[str]:
    # Most production X12 uses ~; the supplied sample is one segment per line.
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if "~" in normalized:
        raw = normalized.replace("\n", "").split("~")
    else:
        raw = normalized.split("\n")
    for seg in raw:
        seg = seg.strip()
        if seg:
            yield seg


def _element(parts: List[str], number: int) -> str:
    """Return X12 element number (1-based after segment ID)."""
    return parts[number] if len(parts) > number else ""


def _parse_cas(parts: List[str]) -> List[Adjustment]:
    group = _element(parts, 1).strip().upper()
    adjustments: List[Adjustment] = []
    # CAS repetitions: reason/amount/quantity at 2-4, 5-7, ...
    idx = 2
    while idx < len(parts):
        reason = _element(parts, idx).strip().upper()
        amount_text = _element(parts, idx + 1).strip()
        quantity = _element(parts, idx + 2).strip()
        if reason:
            adjustments.append(
                Adjustment(group=group, reason=reason, amount=_decimal(amount_text), quantity=quantity)
            )
        idx += 3
    return adjustments


def parse_835(text: str) -> List[Claim]:
    claims: List[Claim] = []
    current: Claim | None = None
    current_service: ServiceLine | None = None

    for segment in _segments(text):
        parts = segment.split("*")
        tag = parts[0].upper()

        if tag == config.X12_SEGMENT_CLP:
            current = Claim(
                claim_number=_element(parts, 1).strip(),
                status=_element(parts, 2).strip(),
                total_charge=_decimal(_element(parts, 3)),
                total_paid=_decimal(_element(parts, 4)),
                patient_responsibility=_decimal(_element(parts, 5)),
                claim_reference=_element(parts, 7).strip(),
                facility_type=_element(parts, 8).strip(),
                claim_frequency=_element(parts, 9).strip(),
            )
            claims.append(current)
            current_service = None
            continue

        if current is None:
            continue

        if tag == config.X12_SEGMENT_NM1:
            entity = _element(parts, 1).upper()
            if entity == config.X12_ENTITY_PATIENT:
                current.patient_last_name = _element(parts, 3).strip()
                current.patient_first_name = _element(parts, 4).strip()
                current.patient_middle = _element(parts, 5).strip()
            elif entity == config.X12_ENTITY_SUBSCRIBER:
                # NM109 is subscriber/member ID. Prefer explicit MI qualifier, but
                # tolerate files whose optional elements vary.
                qualifier = _element(parts, 8).upper()
                if qualifier == config.X12_MEMBER_ID_QUALIFIER:
                    current.subscriber_id = _element(parts, 9).strip()
                elif parts:
                    current.subscriber_id = parts[-1].strip()

        elif tag == config.X12_SEGMENT_REF:
            if _element(parts, 1).upper() == config.X12_GROUP_REF_QUALIFIER:
                current.group_number = _element(parts, 2).strip()

        elif tag == config.X12_SEGMENT_DTM:
            qualifier = _element(parts, 1)
            value = _element(parts, 2).strip()
            if qualifier == config.X12_DOB_QUALIFIER:
                current.dob = value
            elif qualifier == config.X12_CLAIM_RECEIVED_DATE_QUALIFIER:
                current.claim_received_date = value
            elif qualifier == config.X12_SERVICE_DATE_QUALIFIER and current_service is not None:
                current_service.service_date = value

        elif tag == config.X12_SEGMENT_SVC:
            composite = _element(parts, 1).strip()
            procedure = composite.split(":", 1)[1] if ":" in composite else composite
            units = _decimal(_element(parts, 5), "1")
            current_service = ServiceLine(
                procedure=procedure,
                charge=_decimal(_element(parts, 2)),
                paid=_decimal(_element(parts, 3)),
                units=units,
            )
            current.services.append(current_service)

        elif tag == config.X12_SEGMENT_CAS and current_service is not None:
            current_service.adjustments.extend(_parse_cas(parts))

    return claims
