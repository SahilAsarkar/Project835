import os
import uuid
import time
import logging
from pathlib import Path

from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse, FileResponse

from . import config
from .converter import convert_835_to_mir
from .mapping_defaults import defaults
from .mapping_store import get_mappings, reset_mappings, save_mappings, validate_mappings

logger = logging.getLogger(__name__)

def _mapping_change_count(current: list[dict]) -> int:
    baseline = {field["id"]: field for field in defaults()}
    editable = ("mapType", "map", "length", "start", "upper", "trim", "truncate", "align", "pad", "fallbackType", "fallbackValue", "technicalRule")
    return sum(
        1
        for field in current
        if any(str(field.get(key)) != str(baseline[field["id"]].get(key)) for key in editable)
    )

def _safe_output_name(filename: str) -> str:
    stem = Path(filename or "input_835").stem
    stem = stem.encode("ascii", errors="ignore").decode("ascii")
    stem = "".join(character for character in stem if character.isalnum() or character in "-_").strip(" .")
    stem = stem[:80] or "input_835"
    if stem.upper() in config.WINDOWS_RESERVED_NAMES if hasattr(config, 'WINDOWS_RESERVED_NAMES') else []:
        stem = f"_{stem}"
    return f"{stem}{config.OUTPUT_EXTENSION}"

def _write_artifact(artifact_id: str, mir_text: str) -> Path:
    data = mir_text.encode("ascii")
    config.GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    target = config.GENERATED_DIR / f"{artifact_id}{config.OUTPUT_EXTENSION}"
    with open(target, 'wb') as f:
        f.write(data)
    return target

@api_view(['GET', 'PUT'])
@parser_classes([JSONParser])
def mappings_view(request):
    if request.method == 'GET':
        current = get_mappings()
        return Response({
            "ok": True,
            "baseline": defaults(),
            "fields": current,
            "changed": _mapping_change_count(current)
        })
    elif request.method == 'PUT':
        fields = request.data.get("fields", [])
        if not isinstance(fields, list):
            return Response({"detail": "fields must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            saved = save_mappings(fields)
            return Response({
                "ok": True,
                "fields": saved,
                "note": "Saved mappings are now used by the 835 to MIR converter."
            })
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@parser_classes([JSONParser])
def mappings_check(request):
    fields = request.data.get("fields", [])
    if not isinstance(fields, list):
        return Response({"detail": "fields must be a list"}, status=status.HTTP_400_BAD_REQUEST)
    issues = validate_mappings(fields)
    return Response({"ok": not issues, "issues": issues})

@api_view(['POST'])
def mappings_reset(request):
    fields = reset_mappings()
    return Response({
        "ok": True,
        "fields": fields,
        "note": "Mappings reset to the current converter baseline."
    })

@api_view(['POST'])
@parser_classes([MultiPartParser])
def convert(request):
    if 'file' not in request.FILES:
        return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
    
    file = request.FILES['file']
    data = file.read()
    
    if b"\x00" in data:
        return Response({"detail": "The uploaded file is not valid text."}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
        
    try:
        mir_text, summary = convert_835_to_mir(text)
    except ValueError as exc:
        return Response(
            {"detail": "The uploaded file could not be converted. Check its X12 structure and MIR field limits."},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as exc:
        reference = uuid.uuid4().hex[:12]
        return Response({"detail": f"Conversion failed. Reference: {reference}."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    artifact_id = uuid.uuid4().hex
    output_name = _safe_output_name(file.name or "input_835")
    
    try:
        _write_artifact(artifact_id, mir_text)
    except UnicodeEncodeError:
        return Response(
            {"detail": "The uploaded file contains text that cannot be represented in ASCII MIR output."},
            status=status.HTTP_400_BAD_REQUEST
        )
    except OSError:
        reference = uuid.uuid4().hex[:12]
        return Response({"detail": f"Conversion failed. Reference: {reference}."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    changed = _mapping_change_count(get_mappings())
    return Response({
        "ok": True,
        "summary": summary,
        "download_url": f"/api/download/{artifact_id}",
        "output_name": output_name,
        "mapping_changes": changed,
        "note": "Generated with the current Mapping Configuration. " + (f"{changed} field(s) differ from the baseline converter." if changed else "Mappings match the baseline converter.")
    })

@api_view(['GET'])
def download(request, artifact_id):
    path = config.GENERATED_DIR / f"{artifact_id}{config.OUTPUT_EXTENSION}"
    if not path.exists():
        return Response({"detail": "Download not found or expired."}, status=status.HTTP_404_NOT_FOUND)
    
    return FileResponse(open(path, 'rb'), as_attachment=True, filename=f"{artifact_id}{config.OUTPUT_EXTENSION}")
