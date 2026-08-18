import json
import os
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt

from converter.services.parser import parse_835_to_mir
from converter.services.validator import EDI835Validator
from edi835.models import EDI835File
from edi835.services import process_edi835_file_content


@csrf_exempt
def api_convert(request):
    """
    API Endpoint: Convert EDI 835 text or uploaded file to MIR format.
    Runs when 'Submit & Convert to MIR' is clicked.
    Executes input -> processing -> output/archive pipeline tracking.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed.'}, status=405)

    edi_text = ""
    original_filename = "uploaded_file.x12"
    file_id = None

    file_obj = request.FILES.get('edi_file')
    if file_obj:
        original_filename = file_obj.name
        try:
            edi_text = file_obj.read().decode('utf-8', errors='ignore')
        except Exception as e:
            return JsonResponse({'error': f'Failed to read uploaded file: {str(e)}'}, status=400)
    else:
        if request.content_type == 'application/json':
            try:
                body = json.loads(request.body.decode('utf-8'))
                edi_text = body.get('edi_text', '')
                original_filename = body.get('original_filename', 'pasted_file.x12')
                file_id = body.get('file_id')
            except Exception:
                edi_text = ''
        else:
            edi_text = request.POST.get('edi_text', '')
            original_filename = request.POST.get('original_filename', 'pasted_file.x12')
            file_id = request.POST.get('file_id')

    edi_text = edi_text.strip()
    if not edi_text and file_id:
        try:
            from pathlib import Path
            from django.conf import settings
            from edi835.services import get_edi835_storage_dirs
            rec = EDI835File.objects.get(id=file_id)
            if rec.original_filename:
                original_filename = rec.original_filename
            dirs = get_edi835_storage_dirs()
            possible_paths = []
            if rec.input_path:
                possible_paths.append(Path(settings.BASE_DIR) / rec.input_path)
            if rec.archive_path:
                possible_paths.append(Path(settings.BASE_DIR) / rec.archive_path)
            if rec.stored_filename:
                possible_paths.append(dirs["input"] / rec.stored_filename)
                possible_paths.append(dirs["processing"] / rec.stored_filename)
                possible_paths.append(dirs["archive"] / rec.stored_filename)

            for p in possible_paths:
                if os.path.exists(p) and os.path.isfile(p):
                    with open(p, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read().strip()
                    if content:
                        edi_text = content
                        break
        except Exception:
            pass

    if not edi_text:
        return JsonResponse({'error': 'Please provide EDI 835 text or upload a file.'}, status=400)

    res = process_edi835_file_content(edi_text, original_filename=original_filename, file_id=file_id)

    if not res.get("success"):
        return JsonResponse({
            'error': f'Failed to convert EDI file: {res.get("error")}',
            'file_id': str(res["db_record"].id) if res.get("db_record") else None
        }, status=400)

    return JsonResponse({
        'success': True,
        'text': res['mir_text'],
        'claims_count': res['claims_count'],
        'services_count': res['services_count'],
        'records_count': res['records_count'],
        'file_id': str(res['db_record'].id),
        'output_path': res['db_record'].output_path,
        'archive_path': res['db_record'].archive_path,
    })


@csrf_exempt
def api_validate(request):
    """
    API Endpoint: Validate EDI 835 files using Local X12/835 PyX12 Engine.
    Creates or updates EDI835File DB record:
    - Status "PROCESSING" if validation passes (Validated, waiting for Process MIR)
    - Status "ERROR" if validation fails (Runs needing attention)
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed.'}, status=405)

    edi_text = ""
    original_filename = "uploaded_file.x12"

    file_obj = request.FILES.get('edi_file')
    if file_obj:
        original_filename = file_obj.name
        try:
            edi_text = file_obj.read().decode('utf-8', errors='ignore')
        except Exception as e:
            return JsonResponse({'error': f'Failed to read uploaded file: {str(e)}'}, status=400)
    else:
        if request.content_type == 'application/json':
            try:
                body = json.loads(request.body.decode('utf-8'))
                edi_text = body.get('edi_text', '')
                original_filename = body.get('original_filename', 'pasted_file.x12')
            except Exception:
                edi_text = ''
        else:
            edi_text = request.POST.get('edi_text', '')
            original_filename = request.POST.get('original_filename', 'pasted_file.x12')

    edi_text = edi_text.strip()
    if not edi_text:
        return JsonResponse({'error': 'Please provide EDI content to validate.'}, status=400)

    try:
        from pathlib import Path
        from django.conf import settings
        from edi835.services import get_edi835_storage_dirs

        dirs = get_edi835_storage_dirs()
        archive_file_path = dirs["archive"] / original_filename
        with open(archive_file_path, "w", encoding="utf-8") as f:
            f.write(edi_text)
        rel_archive_path = (Path("media") / "edi835" / "archive" / original_filename).as_posix()

        validator = EDI835Validator()
        report = validator.validate(edi_text)

        is_valid = report.get('valid', report.get('is_valid', True))
        claims_found = report.get('claims', report.get('claims_found', 0))

        report['is_valid'] = is_valid
        report['claims_found'] = claims_found

        if is_valid:
            db_rec = EDI835File.objects.create(
                original_filename=original_filename,
                stored_filename=original_filename,
                status="PROCESSING",
                claims_count=claims_found,
                archive_path=rel_archive_path,
                input_path=rel_archive_path,
                present_in_archive_folder=True,
            )
        else:
            err_msg = json.dumps(report.get("errors", ["Validation errors found"]))
            db_rec = EDI835File.objects.create(
                original_filename=original_filename,
                stored_filename=original_filename,
                status="ERROR",
                claims_count=claims_found,
                error_message=err_msg,
                archive_path=rel_archive_path,
                input_path=rel_archive_path,
                present_in_archive_folder=True,
            )

        return JsonResponse({
            'success': True,
            'file_id': str(db_rec.id),
            'report': report
        })
    except Exception as err:
        db_rec = EDI835File.objects.create(
            original_filename=original_filename,
            stored_filename=original_filename,
            status="ERROR",
            error_message=str(err),
        )
        return JsonResponse({
            'error': f'Local validation error: {str(err)}',
            'file_id': str(db_rec.id)
        }, status=400)


@csrf_exempt
def download_mir(request):
    """
    Endpoint to trigger `.mir` file download.
    """
    if request.method == 'POST':
        mir_content = request.POST.get('mir_content', '')
        file_name = request.POST.get('file_name', 'output.mir')
    else:
        mir_content = request.GET.get('mir_content', '')
        file_name = request.GET.get('file_name', 'output.mir')

    if not file_name.endswith('.mir'):
        file_name += '.mir'

    response = HttpResponse(mir_content, content_type='text/plain')
    response['Content-Disposition'] = f'attachment; filename="{file_name}"'
    return response


@csrf_exempt
def api_download_archive_zip(request):
    """
    API Endpoint: Creates and streams a ZIP file of archived files.
    type parameter: 'mir' | '835' | 'both'
    """
    import io
    import zipfile
    from edi835.models import EDI835File
    from edi835.services import get_edi835_storage_dirs

    download_type = (request.GET.get("type") or "both").lower()
    dirs = get_edi835_storage_dirs()
    archive_dir = dirs["archive"]
    output_dir = dirs["output"]

    mem_zip = io.BytesIO()
    added_files = set()

    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        records = EDI835File.objects.all()
        for rec in records:
            orig_name = rec.original_filename or rec.stored_filename
            if not orig_name:
                continue
            base_name = os.path.splitext(orig_name)[0]

            # 1. Include 835 EDI file if requested
            if download_type in ["835", "both"]:
                arch_path = archive_dir / orig_name
                if os.path.exists(arch_path) and orig_name not in added_files:
                    zf.write(arch_path, arcname=f"835_files/{orig_name}")
                    added_files.add(orig_name)

            # 2. Include MIR file if requested
            if download_type in ["mir", "both"]:
                mir_filename = f"MIR_{base_name}.mir"
                mir_path = output_dir / f"{base_name}.mir"
                if not os.path.exists(mir_path):
                    mir_path = output_dir / mir_filename

                if os.path.exists(mir_path) and mir_filename not in added_files:
                    zf.write(mir_path, arcname=f"mir_files/{mir_filename}")
                    added_files.add(mir_filename)

        # Sweep output and archive directories for any physical files
        if download_type in ["835", "both"] and os.path.exists(archive_dir):
            for fname in os.listdir(archive_dir):
                fpath = archive_dir / fname
                if os.path.isfile(fpath) and fname not in added_files:
                    zf.write(fpath, arcname=f"835_files/{fname}")
                    added_files.add(fname)

        if download_type in ["mir", "both"] and os.path.exists(output_dir):
            for fname in os.listdir(output_dir):
                fpath = output_dir / fname
                if os.path.isfile(fpath) and fname.endswith(".mir") and fname not in added_files:
                    zf.write(fpath, arcname=f"mir_files/{fname}")
                    added_files.add(fname)

    mem_zip.seek(0)
    filename_map = {
        "mir": "archive_mir_outputs.zip",
        "835": "archive_835_inputs.zip",
        "both": "archive_complete_bundle.zip"
    }
    zip_filename = filename_map.get(download_type, "archive_export.zip")
    response = HttpResponse(mem_zip.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{zip_filename}"'
    return response


@csrf_exempt
def api_get_file_content(request, file_id):
    """
    API Endpoint: Fetch 835 EDI content and generated MIR text for a given file_id.
    """
    try:
        db_rec = EDI835File.objects.get(id=file_id)
    except (EDI835File.DoesNotExist, ValueError):
        return JsonResponse({"error": "File record not found."}, status=404)

    from edi835.services import get_edi835_storage_dirs
    dirs = get_edi835_storage_dirs()

    # 1. Fetch 835 content
    edi_text = ""
    paths_to_check = [
        dirs["archive"] / db_rec.stored_filename if db_rec.stored_filename else None,
        dirs["archive"] / db_rec.original_filename if db_rec.original_filename else None,
        dirs["processing"] / db_rec.stored_filename if db_rec.stored_filename else None,
        dirs["input"] / db_rec.stored_filename if db_rec.stored_filename else None,
        dirs["error"] / db_rec.stored_filename if db_rec.stored_filename else None,
    ]
    for p in paths_to_check:
        if p and os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    edi_text = f.read()
                break
            except Exception:
                pass

    # 2. Fetch MIR content
    mir_text = ""
    base_name = os.path.splitext(db_rec.original_filename)[0] if db_rec.original_filename else "file"
    mir_filename = f"{base_name}.mir"
    mir_path = dirs["output"] / mir_filename
    if os.path.exists(mir_path):
        try:
            with open(mir_path, "r", encoding="utf-8", errors="ignore") as f:
                mir_text = f.read()
        except Exception:
            pass

    # If MIR text doesn't exist on disk but we have 835 text, try parsing on the fly
    if not mir_text and edi_text:
        try:
            res = parse_835_to_mir(edi_text)
            mir_text = res.get("text", "")
        except Exception:
            pass

    return JsonResponse({
        "success": True,
        "file_id": str(db_rec.id),
        "filename": db_rec.original_filename,
        "edi_text": edi_text,
        "mir_text": mir_text,
    })

