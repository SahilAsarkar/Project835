"""Runtime mapping engine driven by the admin mapping configuration."""
from __future__ import annotations

import ast
from datetime import date
from decimal import Decimal
from typing import Any

import config
from mir_mapper import (
    claim_primary_reason,
    co_adjustment_total,
    covered_charge,
    patient_liability,
    payment_reductions,
    service_status_and_reason,
    signed_amount,
    signed_count,
)
from models import Claim, ServiceLine


def _first_adjustment(service: ServiceLine | None):
    if service and service.adjustments:
        return service.adjustments[0]
    return None


def resolve_source(source: str, claim: Claim, service: ServiceLine | None) -> Any:
    """Resolve an allowed UI source id against the normalized 835 model."""
    claim_sources = {
        "CLP01": claim.claim_number,
        "CLP02": claim.status,
        "CLP03": claim.total_charge,
        "CLP04": claim.total_paid,
        "CLP05": claim.patient_responsibility,
        "CLP07": claim.claim_reference,
        "CLP08": getattr(claim, "facility_type", ""),
        "CLP09": getattr(claim, "claim_frequency", ""),
        "NM1[QC].NM103": claim.patient_last_name,
        "NM1[QC].NM104": claim.patient_first_name,
        "NM1[QC].NM105": claim.patient_middle,
        "NM1[IL,MI].NM109": claim.subscriber_id,
        "REF[1L].REF02": claim.group_number,
        "DTM[036].DTM02": claim.dob,
        "DTM[050].DTM02": claim.claim_received_date,
    }
    if source in claim_sources:
        return claim_sources[source]
    if service is None:
        return ""
    adj = _first_adjustment(service)
    service_sources = {
        "SVC01": service.procedure,
        "SVC02": service.charge,
        "SVC03": service.paid,
        "SVC05": service.units,
        "DTM[472].DTM02": service.service_date,
        "CAS.group": adj.group if adj else "",
        "CAS.reason": adj.reason if adj else "",
        "CAS.amount": adj.amount if adj else Decimal("0"),
    }
    return service_sources.get(source, "")


def _formula_env(claim: Claim, service: ServiceLine | None, inherited_reason: str) -> dict[str, Any]:
    svc = service or ServiceLine()
    co = co_adjustment_total(svc)
    pr = sum((a.amount for a in svc.adjustments if a.group == config.X12_PATIENT_RESP_GROUP), Decimal("0"))
    return {
        "CLP03": claim.total_charge,
        "CLP04": claim.total_paid,
        "CLP05": claim.patient_responsibility,
        "SVC02": svc.charge,
        "SVC03": svc.paid,
        "SVC05": svc.units,
        "CO_ADJUSTMENTS": co,
        "PR_ADJUSTMENTS": pr,
        "COVERED_AMOUNT": covered_charge(svc),
        "CLAIM_PRIMARY_REASON": lambda: claim_primary_reason(claim),
        "SERVICE_STATUS": lambda: service_status_and_reason(svc, claim.status, inherited_reason)[0],
        "SERVICE_REASON": lambda: service_status_and_reason(svc, claim.status, inherited_reason)[1],
        "PR_REASON": lambda slot: f"{config.PAYMENT_REDUCTION_CODE_PREFIX}{int(slot)}" if int(slot) in payment_reductions(svc) else "",
        "PR_AMOUNT": lambda slot: payment_reductions(svc).get(int(slot), Decimal("0")),
        "MAX": max,
        "MIN": min,
        "ABS": abs,
    }


_ALLOWED_BINOPS = {ast.Add: lambda a,b:a+b, ast.Sub: lambda a,b:a-b, ast.Mult: lambda a,b:a*b, ast.Div: lambda a,b:a/b}
_ALLOWED_UNARY = {ast.UAdd: lambda a:+a, ast.USub: lambda a:-a}


def _safe_eval_expr(expr: str, env: dict[str, Any]) -> Any:
    tree = ast.parse(expr, mode="eval")

    def ev(node):
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float, str)):
                return Decimal(str(node.value)) if isinstance(node.value, (int, float)) else node.value
            raise ValueError("unsupported constant")
        if isinstance(node, ast.Name):
            if node.id not in env or callable(env[node.id]):
                raise ValueError(f"unknown formula value {node.id}")
            return env[node.id]
        if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
            return _ALLOWED_BINOPS[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARY:
            return _ALLOWED_UNARY[type(node.op)](ev(node.operand))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            fn = env.get(node.func.id)
            if not callable(fn):
                raise ValueError(f"unsupported formula function {node.func.id}")
            if node.keywords:
                raise ValueError("formula keywords are not supported")
            return fn(*[ev(a) for a in node.args])
        raise ValueError(f"unsupported formula syntax: {type(node).__name__}")

    return ev(tree)


def evaluate_formula(field: dict[str, Any], claim: Claim, service: ServiceLine | None, inherited_reason: str) -> Any:
    rule = str(field.get("technicalRule") or field.get("map") or "").strip()
    # Backward-compatible names from earlier POC labels.
    aliases = {
        "CLAIM_PRIMARY_REASON(CLP02, SVC[*].CAS[*])": "CLAIM_PRIMARY_REASON()",
        "SERVICE_STATUS(CLP02, SVC03, CAS[*])": "SERVICE_STATUS()",
        "SERVICE_REASON(CLP02, SVC03, CAS[*], CLAIM_PRIMARY_REASON)": "SERVICE_REASON()",
        "COVERED_CHARGE(SVC02, CAS[*])": "MAX(SVC02 - CO_ADJUSTMENTS, 0)",
        "PATIENT_LIABILITY(COVERED_CHARGE(SVC02,CAS[*]), SVC03)": "MAX(COVERED_AMOUNT - SVC03, 0)",
    }
    rule = aliases.get(rule, rule)
    return _safe_eval_expr(rule, _formula_env(claim, service, inherited_reason))


def system_value(name: str, sequence: int, max_sequence: int, service_count: int) -> str:
    if name == "PROCESS_DATE":
        return date.today().strftime(config.PROCESS_DATE_FORMAT)
    if name == "RECORD_SEQUENCE":
        return f"{sequence:02d}"
    if name == "MAX_RECORD_SEQUENCE":
        return f"{max_sequence:02d}"
    if name == "SERVICE_COUNT":
        return f"{service_count:02d}"
    return ""


def _format_numeric(value: Any, length: int) -> str:
    if isinstance(value, str) and value and value[-1:] in {"+", "-"} and value[:-1].isdigit():
        return value
    try:
        dec = value if isinstance(value, Decimal) else Decimal(str(value or "0"))
    except Exception:
        return str(value or "")
    if length == 11:
        return signed_amount(dec)
    if length == 6:
        return signed_count(dec, 5)
    if length == 5:
        return signed_count(dec, 4)
    return str(value)


def evaluate_field(field: dict[str, Any], claim: Claim, service: ServiceLine | None,
                   sequence: int, max_sequence: int, service_count: int,
                   inherited_reason: str = "") -> str:
    map_type = field.get("mapType")
    if map_type == "Blank":
        value: Any = ""
    elif map_type == "Hardcoded Text":
        value = field.get("map", "")
    elif map_type == "System / Runtime":
        value = system_value(str(field.get("map", "")), sequence, max_sequence, service_count)
    elif map_type == "Direct from 835":
        value = resolve_source(str(field.get("map", "")), claim, service)
        if value in (None, "") and field.get("fallbackType") == "Hardcoded":
            value = field.get("fallbackValue", "")
    elif map_type == "Formula":
        value = evaluate_formula(field, claim, service, inherited_reason)
    else:
        value = ""

    if field.get("type") == "N" and map_type in {"Direct from 835", "Formula"}:
        value = _format_numeric(value, int(field.get("length", 1)))
    else:
        value = "" if value is None else str(value)

    if field.get("trim", True):
        value = value.strip()
    if field.get("upper", False):
        value = value.upper()
    if field.get("truncate", True):
        value = value[: int(field.get("length", 1))]
    return value
