"""Business mapping from parsed 835 data to MIR values."""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List

import config
from models import Claim, ServiceLine


def normalize_text(value: str, length: int) -> str:
    value = (value or "").strip()
    if config.UPPERCASE_TEXT_FIELDS:
        value = value.upper()
    return value[:length]


def normalize_member_id(value: str) -> str:
    value = normalize_text(value, 999)
    if len(value) <= config.MEMBER_ID_LENGTH:
        return value
    if config.MEMBER_ID_TRUNCATION == "right":
        return value[-config.MEMBER_ID_LENGTH:]
    return value[:config.MEMBER_ID_LENGTH]


def signed_amount(value: Decimal, digits: int = config.SIGNED_AMOUNT_DIGITS) -> str:
    q = Decimal("1").scaleb(-config.AMOUNT_DECIMAL_PLACES)
    value = value.quantize(q, rounding=ROUND_HALF_UP)
    sign = "+" if value >= 0 else "-"
    cents = int(abs(value) * (10 ** config.AMOUNT_DECIMAL_PLACES))
    return f"{cents:0{digits}d}{sign}"[-(digits + 1):]


def signed_count(value: Decimal, digits: int) -> str:
    rounded = int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    sign = "+" if rounded >= 0 else "-"
    return f"{abs(rounded):0{digits}d}{sign}"[-(digits + 1):]


def co_adjustment_total(service: ServiceLine) -> Decimal:
    total = sum((a.amount for a in service.adjustments if a.group == config.X12_CONTRACTUAL_GROUP), Decimal("0"))
    # Some supplied CAS segments repeat a positive adjustment.  The real MIR
    # never lets a positive contractual reduction drive covered charge below
    # zero, so cap only the positive side.  Negative CO adjustments are valid
    # reversals/increases and must remain negative.
    if total > service.charge:
        total = service.charge
    return total


def covered_charge(service: ServiceLine) -> Decimal:
    value = service.charge - co_adjustment_total(service)
    if not config.ALLOW_NEGATIVE_DERIVED_AMOUNTS:
        value = max(value, Decimal("0"))
    return value


def patient_liability(service: ServiceLine) -> Decimal:
    value = covered_charge(service) - service.paid
    if not config.ALLOW_NEGATIVE_DERIVED_AMOUNTS:
        value = max(value, Decimal("0"))
    return value


def first_adjustment_code(service: ServiceLine, group: str | None = None) -> str:
    for adj in service.adjustments:
        if group is not None and adj.group != group:
            continue
        candidate = f"{adj.group}{adj.reason}"
        if candidate:
            return normalize_text(candidate, config.PRIMARY_REASON_LENGTH)
    return ""


def claim_primary_reason(claim: Claim) -> str:
    # Non-paid claim dispositions in the supplied pair use the first CAS reason.
    if claim.status != config.PAID_CLAIM_STATUS:
        for service in claim.services:
            code = first_adjustment_code(service)
            if code:
                return code
        return ""

    # A paid claim can still carry a claim-level CO edit when one or more lines
    # are fully reduced by a non-standard contractual reason (e.g. CO41 in the
    # supplied reference).  CO45 is ordinary contractual pricing and is not
    # promoted to the claim header.
    for service in claim.services:
        for adj in service.adjustments:
            if adj.group == config.X12_CONTRACTUAL_GROUP and adj.reason != config.STANDARD_CONTRACTUAL_PRICING_REASON and adj.amount >= service.charge and service.charge > 0:
                return normalize_text(f"{adj.group}{adj.reason}", config.PRIMARY_REASON_LENGTH)
    return ""


def service_status_and_reason(service: ServiceLine, claim_status: str, inherited_reason: str = "") -> tuple[str, str]:
    if claim_status != config.PAID_CLAIM_STATUS:
        return claim_status, first_adjustment_code(service) or inherited_reason

    # Claim-level edit codes such as CO41 are carried on each line while the
    # claim remains paid status 1.
    if inherited_reason:
        return claim_status, inherited_reason

    # A line inside an otherwise paid claim can be denied/patient-responsibility
    # only.  The reference MIR marks those line items as status 4 with the PR code.
    if service.paid == 0 and patient_liability(service) > 0:
        for adj in service.adjustments:
            if adj.group != config.X12_PATIENT_RESP_GROUP:
                continue
            # PR1/PR2/PR3 are ordinary deductible/coinsurance/copay and do not
            # turn an otherwise paid claim line into MIR status 4.  Other PR
            # reasons observed in the supplied pair (e.g. PR31/PR119) do.
            if adj.reason not in config.ORDINARY_PATIENT_RESPONSIBILITY_REASONS:
                return "4", normalize_text(f"{config.X12_PATIENT_RESP_GROUP}{adj.reason}", config.PRIMARY_REASON_LENGTH)

    return claim_status, ""


def payment_reductions(service: ServiceLine) -> Dict[int, Decimal]:
    result: Dict[int, Decimal] = {}
    for adj in service.adjustments:
        if adj.group != config.PAYMENT_REDUCTION_CODE_PREFIX:
            continue
        try:
            reason_number = int(adj.reason)
        except ValueError:
            continue
        if config.PAYMENT_REDUCTION_MIN_REASON <= reason_number <= config.PAYMENT_REDUCTION_MAX_REASON:
            result[reason_number] = result.get(reason_number, Decimal("0")) + adj.amount
    return result



def process_date_value() -> str:
    """Return the runtime process date used in both MIR header date fields."""
    if not config.USE_PROCESS_DATE_FOR_HEADER_DATES:
        return ""
    return date.today().strftime(config.PROCESS_DATE_FORMAT)


def map_header(claim: Claim, sequence: int, max_sequence: int, service_count: int,
               enrichment: Dict[str, str] | None = None) -> Dict[str, str]:
    enrichment = enrichment or {}
    first_reason = claim_primary_reason(claim)
    process_date = process_date_value()
    return {
        "record_type": config.MIR_RECORD_TYPE,
        "claim_number": normalize_text(claim.claim_number, config.CLAIM_NUMBER_LENGTH),
        "claim_reference": normalize_text(claim.claim_reference, config.CLAIM_REFERENCE_LENGTH),
        "api_date_1": normalize_text(enrichment.get("api_date_1", process_date or config.API_DATE_1_DEFAULT), 8),
        "api_date_2": normalize_text(enrichment.get("api_date_2", process_date or config.API_DATE_2_DEFAULT), 8),
        "claim_status": normalize_text(claim.status, config.CLAIM_STATUS_LENGTH),
        "primary_reason": first_reason,
        "member_id": normalize_member_id(claim.subscriber_id),
        "group_number": normalize_text(claim.group_number or config.DEFAULT_GROUP_NUMBER, config.GROUP_NUMBER_LENGTH),
        "patient_last_name": normalize_text(claim.patient_last_name, config.PATIENT_LAST_NAME_LENGTH),
        "patient_first_name": normalize_text(claim.patient_first_name, config.PATIENT_FIRST_NAME_LENGTH),
        "patient_middle_initial": normalize_text(claim.patient_middle, config.PATIENT_MIDDLE_INITIAL_LENGTH),
        "dob": normalize_text(claim.dob, config.DOB_LENGTH),
        "claim_numeric_1": config.SIGNED_ZERO_AMOUNT,
        "claim_numeric_2": config.SIGNED_ZERO_AMOUNT,
        "claim_numeric_3": config.SIGNED_ZERO_AMOUNT,
        "claim_numeric_4": config.SIGNED_ZERO_AMOUNT,
        "claim_numeric_5": config.SIGNED_ZERO_AMOUNT,
        "claim_numeric_6": config.SIGNED_ZERO_AMOUNT,
        "claim_numeric_7": config.SIGNED_ZERO_AMOUNT,
        "claim_numeric_8": config.SIGNED_ZERO_AMOUNT,
        "record_sequence": f"{sequence:02d}",
        "max_record_sequence": f"{max_sequence:02d}",
        "service_count": f"{service_count:02d}",
    }


def map_service(service: ServiceLine, claim_status: str, inherited_reason: str = "") -> Dict[str, str]:
    reductions = payment_reductions(service)
    line_status, line_reason = service_status_and_reason(service, claim_status, inherited_reason)
    mapped = {
        "status": normalize_text(line_status, 1),
        "primary_reason": line_reason,
        "service_units": signed_count(service.units, 5),
        "approved_units": config.SIGNED_ZERO_COUNT_5,
        "small_count": config.SIGNED_ZERO_COUNT_4,
        "line_numeric_1": config.SIGNED_ZERO_AMOUNT,
        "service_charge": signed_amount(service.charge),
        "line_numeric_2": config.SIGNED_ZERO_AMOUNT,
        "line_numeric_3": config.SIGNED_ZERO_AMOUNT,
        "covered_charge": signed_amount(covered_charge(service)),
        "paid_amount": signed_amount(service.paid),
        "patient_liability": signed_amount(patient_liability(service)),
        "small_numeric_2": config.SIGNED_ZERO_COUNT_4,
        "line_numeric_4": config.SIGNED_ZERO_AMOUNT,
        "line_numeric_5": config.SIGNED_ZERO_AMOUNT,
        "payment_reductions": reductions,
    }
    return mapped
