# Current 835 → MIR Mapping Notes

## Claim header

| MIR area | 835 source / rule | Status |
|---|---|---|
| Record Type | `MO` from `config.py` | Constant |
| Claim number | `CLP01` | Direct |
| Claim reference | `CLP07` | Direct |
| Header API date 1 | Not reliably present in supplied 835 | Blank/API |
| Header API date 2 | Not reliably present in supplied 835 | Blank/API |
| Claim status | `CLP02` | Direct |
| Primary denial/edit reason | First CAS group+reason when status is not paid | Derived |
| Member ID | `NM1*IL` member ID, configurable 12-char normalization | Direct/format |
| Group | `REF*1L` | Direct |
| Patient name | `NM1*QC` | Direct |
| DOB | `DTM*036` | Direct |
| Sequence/max sequence | Split service lines in groups of configured max 50 | Derived |
| Service count | Number of SVC lines in current MIR record | Derived |

## Service block

| MIR area | 835 source / rule | Status |
|---|---|---|
| Status | Claim `CLP02` | Direct |
| Primary reason | First CAS group+reason for non-paid claims | Derived |
| Units | `SVC05`, default 1 | Direct/default |
| Service charge | `SVC02` | Direct |
| Covered charge | Service charge minus CO adjustment(s), not below zero | Derived |
| Paid amount | `SVC03` | Direct |
| Patient liability | Covered charge minus paid amount, not below zero | Derived |
| PR1..PR10 | CAS group PR, reason numbers 1..10 map to corresponding MIR slots | Direct/format |
| Other unknown numeric fields | MIR fixed numeric default | Default |
| Unknown character fields | spaces | Blank/API |

## Client update: group default and transaction process date

- If claim-level `REF*1L` / `REF02` is present, keep that group number.
- If `REF*1L` is absent or blank, use `DEFAULT_GROUP_NUMBER` from `config.py` (currently `99999999`).
- MIR process-date area (header positions 37-52) contains the converter processing date twice: positions 37-44 and 45-52, producing `YYYYMMDDYYYYMMDD`.
- The process date is generated once at runtime, written into both 8-character date fields, is not hard-coded, and is not taken from an 835 DTM segment.
- The other 8-character MIR date field remains blank/API-required.
