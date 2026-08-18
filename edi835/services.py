import os
import shutil
import uuid
from pathlib import Path
from django.conf import settings
from django.utils import timezone
from django.db import models

from .models import EDI835File
from .parser import parse_835_to_mir, EDI835Validator
from .mir_exporter import export_mir_file


def get_edi835_storage_dirs():
    """
    Returns dictionary of local/FTP storage directories under media/edi835/.
    """
    base_media = Path(getattr(settings, "MEDIA_ROOT", Path(settings.BASE_DIR) / "media"))
    edi_base = base_media / "edi835"

    dirs = {
        "base": edi_base,
        "input": edi_base / "input",
        "processing": edi_base / "processing",
        "output": edi_base / "output",
        "archive": edi_base / "archive",
        "error": edi_base / "error",
    }

    for d in dirs.values():
        os.makedirs(d, exist_ok=True)

    return dirs


def upload_mir_to_sftp(local_file_path, mir_filename):
    """
    Uploads converted .mir file directly to the configured remote SFTP outbound folder.
    """
    try:
        from .models import SFTPConfig
        import paramiko

        cfg = SFTPConfig.objects.first()
        if not cfg or cfg.status != "CONNECTED":
            return False

        out_host = cfg.outbound_host or cfg.host
        out_port = cfg.outbound_port or cfg.port
        out_user = cfg.outbound_username or cfg.username
        out_pass = cfg.outbound_password or cfg.password
        out_folder = cfg.outbound_mir_folder or "/"

        if not out_host or not out_user or not cfg.outbound_mir_folder:
            return False

        ssh = paramiko.SSHClient()
        if cfg.trust_unknown_key:
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        ssh.connect(
            hostname=out_host,
            port=out_port,
            username=out_user,
            password=out_pass,
            timeout=8,
            banner_timeout=8,
            auth_timeout=8,
            look_for_keys=False,
            allow_agent=False,
        )
        sftp = ssh.open_sftp()

        # Ensure directory exists on remote SFTP server
        p = out_folder.strip("/")
        parts = p.split("/") if p else []
        curr = ""
        for part in parts:
            curr += "/" + part
            try:
                sftp.stat(curr)
            except FileNotFoundError:
                try:
                    sftp.mkdir(curr)
                except Exception:
                    pass
            except Exception:
                pass

        remote_path = f"{out_folder.rstrip('/')}/{mir_filename}"
        sftp.put(str(local_file_path), remote_path)

        sftp.close()
        ssh.close()
        return True
    except Exception:
        return False


def push_file_record_to_sftp(file_id):
    """
    Pushes converted MIR file for a specific record ID to SFTP outbound folder.
    Returns (success_boolean, message_string).
    """
    from .models import SFTPConfig, EDI835File
    cfg = SFTPConfig.objects.first()
    if not cfg:
        return False, "No SFTP connection configuration found. Please setup SFTP in Connections section first."

    if cfg.status != "CONNECTED":
        return False, f"SFTP connection is not active (Status: {cfg.status}). Please test and verify your SFTP credentials first."

    try:
        rec = EDI835File.objects.get(id=file_id)
    except (EDI835File.DoesNotExist, ValueError):
        return False, "File record not found in database."

    dirs = get_edi835_storage_dirs()
    success_mir = False

    # Push MIR file to SFTP MIR outbound folder ONLY
    stored_name = rec.stored_filename or rec.original_filename
    if rec.output_path:
        base_name = os.path.splitext(stored_name)[0]
        mir_filename = f"MIR_{base_name}.mir"
        mir_path = Path(settings.BASE_DIR) / rec.output_path
        if not os.path.exists(mir_path):
            mir_path = dirs["output"] / f"{base_name}.mir"

        if os.path.exists(mir_path):
            success_mir = upload_mir_to_sftp(mir_path, mir_filename)

    if success_mir:
        rec.present_in_sftp = True
        rec.save(update_fields=["present_in_sftp"])
        return True, "Successfully pushed MIR file to remote SFTP outbound server!"

    return False, "Failed to upload MIR file to SFTP outbound server. Check SFTP credentials and outbound folder path."


def upload_835_to_sftp(local_file_path, filename):
    """
    Inbound SFTP folder is strictly for receiving 835 files.
    We do NOT push 835 files to inbound SFTP folder.
    """
    return False


def process_edi835_file_content(edi_text, original_filename="uploaded_file.x12", file_id=None):
    edi_text = (edi_text or "").lstrip("\ufeff").strip()
    """
    Processes EDI 835 content through the complete pipeline when 'Submit & Convert to MIR' is triggered:
    1. Save to input/
    2. Move input/ -> processing/ (leaving input/ empty)
    3. Perform MIR conversion
    4. Save converted MIR to output/<base_name>.mir
    5. Move 835 EDI file (.x12/.835) from processing/ -> archive/ (saving ONLY .x12/.835 in archive/, leaving processing/ empty)
    6. On error -> move processing/ -> error/
    """
    dirs = get_edi835_storage_dirs()

    stored_filename = original_filename
    base_name = os.path.splitext(original_filename)[0]
    mir_filename = f"{base_name}.mir"

    # Step 1: Save uploaded file to input/ folder
    input_file_path = dirs["input"] / stored_filename
    with open(input_file_path, "w", encoding="utf-8") as f:
        f.write(edi_text)

    relative_input_path = (Path("media") / "edi835" / "input" / stored_filename).as_posix()

    db_record = None
    if file_id:
        try:
            db_record = EDI835File.objects.get(id=file_id)
        except (EDI835File.DoesNotExist, ValueError):
            db_record = None

    if not db_record:
        file_uuid = uuid.uuid4()
        db_record = EDI835File.objects.create(
            id=file_uuid,
            original_filename=original_filename,
            stored_filename=stored_filename,
            status="UPLOADED",
            input_path=relative_input_path
        )
    else:
        db_record.original_filename = original_filename
        db_record.stored_filename = stored_filename
        db_record.input_path = relative_input_path

    # Step 2: Move file from input/ to processing/ (input/ folder becomes empty)
    processing_file_path = dirs["processing"] / stored_filename
    if os.path.exists(input_file_path):
        shutil.move(input_file_path, processing_file_path)

    db_record.status = "PROCESSING"
    db_record.processing_started_at = timezone.now()
    db_record.save()

    try:
        # Step 3: Perform 835 parsing and MIR conversion during processing
        res = parse_835_to_mir(edi_text)
        mir_text = res["text"]

        # Step 4: Write converted MIR file to output/ folder
        output_mir_path = dirs["output"] / mir_filename
        export_mir_file(mir_text, dirs["output"], mir_filename)
        rel_output_path = (Path("media") / "edi835" / "output" / mir_filename).as_posix()

        # Step 4b: Upload converted .mir file directly to configured SFTP outbound folder if active config exists
        sftp_uploaded = upload_mir_to_sftp(output_mir_path, mir_filename)

        # Step 5: Move original 835/x12 EDI file from processing/ to archive/
        archived_835_path = dirs["archive"] / stored_filename
        if os.path.exists(processing_file_path):
            shutil.move(processing_file_path, archived_835_path)
        rel_archive_path = (Path("media") / "edi835" / "archive" / stored_filename).as_posix()

        db_record.status = "ARCHIVED"
        db_record.output_path = rel_output_path
        db_record.archive_path = rel_archive_path
        db_record.claims_count = res["claims_count"]
        db_record.services_count = res["services_count"]
        db_record.records_count = res["records_count"]
        db_record.error_message = None
        db_record.present_in_sftp = sftp_uploaded
        db_record.present_in_archive_folder = True
        db_record.processing_completed_at = timezone.now()
        db_record.save()

        return {
            "success": True,
            "db_record": db_record,
            "mir_text": mir_text,
            "claims_count": res["claims_count"],
            "services_count": res["services_count"],
            "records_count": res["records_count"],
        }

    except Exception as err:
        err_str = str(err)

        # Step 6: On error, move file from processing/ to error/ folder
        error_file_path = dirs["error"] / stored_filename
        if os.path.exists(processing_file_path):
            shutil.move(processing_file_path, error_file_path)

        db_record.status = "ERROR"
        db_record.error_message = err_str
        db_record.processing_completed_at = timezone.now()
        db_record.save()

        return {
            "success": False,
            "db_record": db_record,
            "error": err_str,
        }


def sync_folder_observer():
    """
    Folder Observer Service:
    1. Scans media/edi835/input/ (SFTP Inbound folder) for any new untracked files dropped into the folder.
       Creates a DB record with present_in_sftp=True.
    2. Scans all EDI835File records and updates physical existence booleans:
       - present_in_sftp: True if file exists in input/ folder on disk.
       - present_in_archive_folder: True if file exists in archive/ folder on disk.
    """
    dirs = get_edi835_storage_dirs()
    input_dir = dirs["input"]
    archive_dir = dirs["archive"]

    # 1. Scan input folder for untracked files dropped into SFTP/input directory
    if os.path.exists(input_dir):
        for fname in os.listdir(input_dir):
            file_path = input_dir / fname
            if os.path.isfile(file_path):
                # Check if already tracked by original_filename or stored_filename
                exists = EDI835File.objects.filter(
                    models.Q(original_filename=fname) | models.Q(stored_filename=fname)
                ).exists()
                if not exists:
                    rel_input_path = (Path("media") / "edi835" / "input" / fname).as_posix()
                    EDI835File.objects.create(
                        original_filename=fname,
                        stored_filename=fname,
                        status="UPLOADED",
                        input_path=rel_input_path,
                        present_in_sftp=True,
                        present_in_archive_folder=False,
                    )

    # 2. Sync physical disk existence for all DB records
    records = EDI835File.objects.all()
    for r in records:
        in_sftp = r.present_in_sftp
        if not in_sftp:
            if r.output_path and os.path.exists(Path(settings.BASE_DIR) / r.output_path):
                in_sftp = True
            elif r.status in ["ARCHIVED", "COMPLETED"]:
                in_sftp = True
            elif r.stored_filename and os.path.exists(input_dir / r.stored_filename):
                in_sftp = True
            elif r.original_filename and os.path.exists(input_dir / r.original_filename):
                in_sftp = True

        in_archive = False
        if r.stored_filename and os.path.exists(archive_dir / r.stored_filename):
            in_archive = True
        elif r.original_filename and os.path.exists(archive_dir / r.original_filename):
            in_archive = True
        elif r.archive_path and os.path.exists(Path(settings.BASE_DIR) / r.archive_path):
            in_archive = True

        if r.present_in_sftp != in_sftp or r.present_in_archive_folder != in_archive:
            r.present_in_sftp = in_sftp
            r.present_in_archive_folder = in_archive
            r.save(update_fields=["present_in_sftp", "present_in_archive_folder"])

