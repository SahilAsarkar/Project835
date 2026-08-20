"""1-based MIR fixed-width field layout.

Every position used by the generator is declared here.  Change layout values
here rather than editing generator logic.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Field:
    start: int  # 1-based inclusive
    length: int

    @property
    def end(self) -> int:
        return self.start + self.length - 1


# 334-character claim header
HEADER = {
    "record_type": Field(1, 2),
    "claim_number": Field(3, 17),
    "claim_reference": Field(20, 6),
    "api_date_1": Field(37, 8),
    "api_date_2": Field(45, 8),
    "claim_status": Field(53, 1),
    "primary_reason": Field(55, 5),
    "member_id": Field(60, 12),
    "group_number": Field(77, 8),
    "patient_last_name": Field(86, 20),
    "patient_first_name": Field(106, 10),
    "patient_middle_initial": Field(116, 1),
    "dob": Field(118, 8),

    # Format/default numeric fields observed in the supplied MIR specification/sample.
    "claim_numeric_1": Field(131, 11),
    "claim_numeric_2": Field(142, 11),
    "claim_numeric_3": Field(153, 11),
    "claim_numeric_4": Field(164, 11),
    "claim_numeric_5": Field(175, 11),
    "claim_numeric_6": Field(186, 11),
    "claim_numeric_7": Field(197, 11),
    "claim_numeric_8": Field(233, 11),

    # Record sequencing for claims with > MAX_SERVICE_LINES_PER_RECORD lines.
    "record_sequence": Field(249, 2),
    "max_record_sequence": Field(251, 2),
    "service_count": Field(333, 2),
}


# 303-character line item block, positions relative to the beginning of the block.
SERVICE = {
    "status": Field(16, 1),
    "primary_reason": Field(18, 5),
    "service_units": Field(23, 6),
    "approved_units": Field(29, 6),
    "small_count": Field(35, 5),
    "line_numeric_1": Field(40, 11),
    "service_charge": Field(51, 11),
    "line_numeric_2": Field(62, 11),
    "line_numeric_3": Field(73, 11),
    "covered_charge": Field(84, 11),
    "paid_amount": Field(95, 11),
    "patient_liability": Field(106, 11),
    "small_numeric_2": Field(117, 5),
    "line_numeric_4": Field(122, 11),
    "line_numeric_5": Field(133, 11),
}

# Ten 5-char reason + 11-char signed amount pairs from position 144 through 303.
PAYMENT_REDUCTION_SLOTS = {
    slot: {
        "reason": Field(144 + (slot - 1) * 16, 5),
        "amount": Field(149 + (slot - 1) * 16, 11),
    }
    for slot in range(1, 11)
}
