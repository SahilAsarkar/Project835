from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from converter import convert_835_to_mir
from edi835_parser import parse_835
from mir_generator import generate_mir_records


def test_small_claim_shape():
    sample = """CLP*86520262053343500*1*40*25.94*6.48*ZZ*QYM647*11*1
NM1*QC*1*WEAVER*TY*M
NM1*IL*1*WEAVER*SHANE****MI*J5YBD0001502
REF*1L*10670170
DTM*036*20110321
SVC*HC:98941*40*25.94**1
DTM*472*20260722
CAS*CO*45*7.58
CAS*PR*2*6.48
"""
    claims = parse_835(sample)
    records, summary = generate_mir_records(claims)
    assert summary["claims"] == 1
    assert len(records) == 1
    assert len(records[0]) == 334 + 303
    r = records[0]
    assert r[0:2] == "MO"
    assert r[2:19] == "86520262053343500"
    assert r[19:25] == "QYM647"
    assert r[59:71] == "J5YBD0001502"
    assert r[76:84] == "10670170"
    b = r[334:]
    assert b[50:61] == "0000004000+"
    assert b[83:94] == "0000003242+"
    assert b[94:105] == "0000002594+"
    assert b[105:116] == "0000000648+"
    # PR2 maps to reduction slot 2.
    assert b[159:164].strip() == "PR2"
    assert b[164:175] == "0000000648+"
