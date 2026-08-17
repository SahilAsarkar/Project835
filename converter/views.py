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
            )
        else:
            err_msg = json.dumps(report.get("errors", ["Validation errors found"]))
            db_rec = EDI835File.objects.create(
                original_filename=original_filename,
                stored_filename=original_filename,
                status="ERROR",
                claims_count=claims_found,
                error_message=err_msg,
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

