"""Future API-enrichment boundary.

The converter intentionally does not invent values that are not present in the
835.  When the external API is known, implement it here and return values using
keys consumed by mir_mapper.py.  The MIR layout/generator does not need to change.
"""
from typing import Dict
from models import Claim


def enrich_claim(claim: Claim) -> Dict[str, str]:
    # Example future return shape:
    # return {
    #     "api_date_1": "20240729",
    #     "api_date_2": "20240729",
    #     "patient_sex": "M",
    # }
    return {}
