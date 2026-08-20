"""Central configuration for the 835 -> MIR converter.

Business constants and MIR defaults belong here.  Keep parsing/generation logic
free of literal business values so format changes can be made in one place.
"""

APP_TITLE = "835 to MIR Converter"
APP_HOST = "127.0.0.1"
APP_PORT = 8000

# MIR record structure
MIR_RECORD_TYPE = "MO"
MIR_HEADER_LENGTH = 334
MIR_SERVICE_BLOCK_LENGTH = 303
MAX_SERVICE_LINES_PER_RECORD = 50
MAX_RECORD_SEQUENCE = 99
SERVICE_OVERFLOW_MODE = "split"  # "split" per spec; change to "truncate" to mimic capped samples

# Fixed-width padding/defaults
BLANK_CHAR = " "
SIGNED_ZERO_AMOUNT = "0000000000+"   # 10 digits + trailing sign
SIGNED_ZERO_COUNT_5 = "00000+"       # 5 digits + trailing sign
SIGNED_ZERO_COUNT_4 = "0000+"        # 4 digits + trailing sign
DEFAULT_SERVICE_UNITS = "00001+"
DEFAULT_RECORD_SEQUENCE = 1

# Field lengths / normalization
CLAIM_NUMBER_LENGTH = 17
CLAIM_REFERENCE_LENGTH = 6
MEMBER_ID_LENGTH = 12
GROUP_NUMBER_LENGTH = 8
DEFAULT_GROUP_NUMBER = "99999999"  # used only when REF*1L is absent/blank
PATIENT_LAST_NAME_LENGTH = 20
PATIENT_FIRST_NAME_LENGTH = 10
PATIENT_MIDDLE_INITIAL_LENGTH = 1
DOB_LENGTH = 8
CLAIM_STATUS_LENGTH = 1
PRIMARY_REASON_LENGTH = 5
SERVICE_COUNT_LENGTH = 2


# X12 835 segment / qualifier constants
X12_SEGMENT_CLP = "CLP"
X12_SEGMENT_NM1 = "NM1"
X12_SEGMENT_REF = "REF"
X12_SEGMENT_DTM = "DTM"
X12_SEGMENT_SVC = "SVC"
X12_SEGMENT_CAS = "CAS"
X12_ENTITY_PATIENT = "QC"
X12_ENTITY_SUBSCRIBER = "IL"
X12_MEMBER_ID_QUALIFIER = "MI"
X12_GROUP_REF_QUALIFIER = "1L"
X12_DOB_QUALIFIER = "036"
X12_CLAIM_RECEIVED_DATE_QUALIFIER = "050"
X12_SERVICE_DATE_QUALIFIER = "472"
X12_CONTRACTUAL_GROUP = "CO"
X12_PATIENT_RESP_GROUP = "PR"
STANDARD_CONTRACTUAL_PRICING_REASON = "45"
ORDINARY_PATIENT_RESPONSIBILITY_REASONS = {"1", "2", "3"}

# 835 mapping behavior
PAID_CLAIM_STATUS = "1"
UPPERCASE_TEXT_FIELDS = True
MEMBER_ID_TRUNCATION = "left"  # "left" keeps the first MEMBER_ID_LENGTH characters

# Unknown/API-sourced fields are intentionally blank unless a current business
# rule supplies them. API enrichment can still override these values later.
API_ENRICHMENT_ENABLED = False
API_DATE_1_DEFAULT = ""
API_DATE_2_DEFAULT = ""

# MIR process-date behavior. The 16-character date area is two adjacent
# YYYYMMDD fields (positions 37-44 and 45-52). Both are populated from the
# date the converter processes the file, not from an 835 DTM segment.
USE_PROCESS_DATE_FOR_HEADER_DATES = True
PROCESS_DATE_FORMAT = "%Y%m%d"

# Numeric behavior
AMOUNT_DECIMAL_PLACES = 2
SIGNED_AMOUNT_DIGITS = 10
ALLOW_NEGATIVE_DERIVED_AMOUNTS = False

# Payment reduction slots in the MIR service block.  The reference layout maps
# PR1..PR10 by reason number to slots 1..10.
PAYMENT_REDUCTION_MIN_REASON = 1
PAYMENT_REDUCTION_MAX_REASON = 10
PAYMENT_REDUCTION_CODE_PREFIX = X12_PATIENT_RESP_GROUP

# Web UI
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
OUTPUT_EXTENSION = ".mir"
DOWNLOAD_TOKEN_LENGTH = 24
