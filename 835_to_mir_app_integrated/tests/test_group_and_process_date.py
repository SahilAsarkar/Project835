from datetime import date
from decimal import Decimal
from unittest.mock import patch

import config
from mir_mapper import map_header
from models import Claim


def make_claim(group_number=""):
    return Claim(
        claim_number="12345678901234567",
        status="1",
        total_charge=Decimal("10"),
        total_paid=Decimal("8"),
        patient_responsibility=Decimal("2"),
        claim_reference="ABC123",
        subscriber_id="MEMBER123456",
        group_number=group_number,
        patient_last_name="DOE",
        patient_first_name="JANE",
        patient_middle="Q",
        dob="19900101",
        services=[],
    )


def test_blank_group_defaults_to_99999999():
    values = map_header(make_claim(""), 1, 1, 0, {})
    assert values["group_number"] == config.DEFAULT_GROUP_NUMBER == "99999999"


def test_existing_group_is_preserved():
    values = map_header(make_claim("10670170"), 1, 1, 0, {})
    assert values["group_number"] == "10670170"


def test_process_date_is_written_twice_in_16_char_date_area():
    with patch("mir_mapper.date") as mock_date:
        mock_date.today.return_value = date(2026, 8, 13)
        values = map_header(make_claim("10670170"), 1, 1, 0, {})
    assert values["api_date_1"] == "20260813"
    assert values["api_date_2"] == "20260813"
    assert values["api_date_1"] + values["api_date_2"] == "2026081320260813"
