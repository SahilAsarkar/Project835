import secrets
from pathlib import Path

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

import config
from converter import convert_835_to_mir
from mapping_defaults import defaults
from mapping_store import get_mappings, reset_mappings, save_mappings, validate_mappings

BASE_DIR = Path(__file__).resolve().parent
GENERATED_DIR = BASE_DIR / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

app = FastAPI(title=config.APP_TITLE)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

_downloads: dict[str, Path] = {}


@app.get("/", response_class=HTMLResponse)
def home():
    return (BASE_DIR / "templates" / "index.html").read_text(encoding="utf-8")


@app.get("/mapping", response_class=HTMLResponse)
def mapping_page():
    return (BASE_DIR / "templates" / "mapping.html").read_text(encoding="utf-8")


@app.get("/api/mappings")
def mappings_get():
    current = get_mappings()
    baseline = {f["id"]: f for f in defaults()}
    editable = ("mapType","map","length","start","upper","trim","truncate","align","pad","fallbackType","fallbackValue")
    changed = sum(
        1 for f in current
        if any(str(f.get(k)) != str(baseline[f["id"]].get(k)) for k in editable)
    )
    return {"ok": True, "fields": current, "changed": changed}


@app.post("/api/mappings/check")
def mappings_check(payload: dict = Body(...)):
    fields = payload.get("fields", [])
    if not isinstance(fields, list):
        raise HTTPException(status_code=400, detail="fields must be a list")
    issues = validate_mappings(fields)
    return {"ok": not issues, "issues": issues}


@app.put("/api/mappings")
def mappings_save(payload: dict = Body(...)):
    fields = payload.get("fields", [])
    if not isinstance(fields, list):
        raise HTTPException(status_code=400, detail="fields must be a list")
    try:
        saved = save_mappings(fields)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "fields": saved, "note": "Saved mappings are now used by the 835 → MIR converter."}


@app.post("/api/mappings/reset")
def mappings_reset():
    fields = reset_mappings()
    return {"ok": True, "fields": fields, "note": "Mappings reset to the current converter baseline."}


@app.post("/api/convert")
async def convert(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file is too large.")

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        text = data.decode("latin-1", errors="replace")

    try:
        mir_text, summary = convert_835_to_mir(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {exc}") from exc

    token = secrets.token_urlsafe(config.DOWNLOAD_TOKEN_LENGTH)
    original_stem = Path(file.filename or "input_835").stem
    safe_stem = "".join(ch for ch in original_stem if ch.isalnum() or ch in "-_") or "input_835"
    output_path = GENERATED_DIR / f"{safe_stem}{config.OUTPUT_EXTENSION}"
    if output_path.exists():
        output_path = GENERATED_DIR / f"{safe_stem}_{token[:8]}{config.OUTPUT_EXTENSION}"
    output_path.write_text(mir_text, encoding="ascii", errors="replace", newline="")
    _downloads[token] = output_path

    current = get_mappings()
    baseline = {f["id"]: f for f in defaults()}
    editable = ("mapType","map","length","start","upper","trim","truncate","align","pad","fallbackType","fallbackValue")
    changed = sum(
        1 for f in current
        if any(str(f.get(k)) != str(baseline[f["id"]].get(k)) for k in editable)
    )

    return {
        "ok": True,
        "summary": summary,
        "download_url": f"/download/{token}",
        "output_name": output_path.name,
        "mapping_changes": changed,
        "note": (
            "Generated with the current Mapping Configuration. "
            + (f"{changed} field(s) differ from the baseline converter." if changed else "Mappings match the baseline converter.")
        ),
    }


@app.get("/download/{token}")
def download(token: str):
    path = _downloads.get(token)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Download not found. Please convert the file again.")
    return FileResponse(path, media_type="text/plain", filename=path.name)
