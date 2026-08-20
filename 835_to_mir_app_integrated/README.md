# 835 → MIR Converter (UI + CLI)

This project converts X12 835 claim/payment data into the fixed-width MIR/MO structure reverse-engineered from the supplied production sample and proprietary MIR specification.

## What this version does

- Upload an 835 through a local web UI.
- Parses CLP, NM1 QC/IL, REF 1L, DTM, SVC and CAS.
- Generates one MIR `MO` record per claim, splitting claims into additional records after 50 service lines.
- Populates fields confidently available/derivable from the 835.
- Preserves unavailable/API-sourced fields as fixed-width blanks or format defaults.
- Downloads the generated `.mir` file.
- Also includes a CLI for batch use.

## Important design rule

Business constants are centralized in `config.py` and fixed positions are centralized in `mir_layout.py`. Do not scatter business constants inside converter logic.

Future API-only fields belong in `api_enrichment.py`.

## Windows: easiest way to run

1. Install **Python 3.12** and make sure the Python launcher (`py`) is available.
2. Extract this ZIP.
3. Double-click `run.bat`.
4. Your browser opens at `http://127.0.0.1:8000`.
5. Upload the 835 and click **Generate MIR**.
6. Click **Download MIR**.

The first run installs the required Python packages into a local `.venv` folder.

## Run manually

```powershell
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000`.

## CLI

```powershell
python cli.py "my835.x12" -o "output.mir"
```

## Central configuration

Edit `config.py` for constants such as:

- `MIR_RECORD_TYPE`
- `MIR_HEADER_LENGTH`
- `MIR_SERVICE_BLOCK_LENGTH`
- `MAX_SERVICE_LINES_PER_RECORD`
- `SERVICE_OVERFLOW_MODE` (`split` by the spreadsheet specification; `truncate` available if production confirms that behavior)
- `MEMBER_ID_LENGTH`
- defaults and amount formatting

Edit `mir_layout.py` if a fixed MIR start position or field length changes.

## Current mapping notes

Known direct/derived fields include claim number, claim reference, claim status, member ID, group number, patient name, DOB, service charge, paid amount, covered charge, patient liability, service count, PR1–PR10 payment-reduction slots, and claim splitting/sequence.

The two MIR header dates observed in the supplied reference MIR are intentionally blank because they do not match a reliable date source in the supplied 835. They can later be populated through `api_enrichment.py`.

## Validation status

This is a working **v1 converter**, not yet a production certification. It is validated against the supplied 835/MIR pair for the mapped fields and fixed record lengths. Before replacing a production MIR feed, validate another known-good 835/MIR pair and connect the missing API-sourced fields.

### Current configurable client rules

`config.py` controls the current blank-group default and transaction date behavior:

- `DEFAULT_GROUP_NUMBER = "99999999"`
- `USE_PROCESS_DATE_FOR_TRANSACTION_DATE = True`
- `PROCESS_DATE_FORMAT = "%Y%m%d"`

Existing 835 group numbers from `REF*1L` are preserved. The default is used only when that group is missing. The both 8-character header date fields are generated from the same local processing date each time the conversion runs, producing `YYYYMMDDYYYYMMDD`.

## MIR Mapping Configuration

The converter now includes an internal mapping page at:

```text
http://127.0.0.1:8000/mapping
```

The default mapping configuration reproduces the previous code-driven converter. On the mapping page you can change a MIR field to use:

- Direct from 835
- Formula
- Hardcoded Text
- System / Runtime value
- Blank

`Save & use` persists the configuration in `data/mapping_config.json`. The next 835 conversion uses the saved mapping automatically. `Reset all to baseline` removes the override and restores the original converter behavior.

Before saving, `Check mappings` validates field positions, sizes, overlapping ranges, mapping types, and supported 835 sources.
