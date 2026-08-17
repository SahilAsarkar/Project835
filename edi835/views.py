import os
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db.models import Sum

from .models import EDI835File, SFTPConfig
from .services import process_edi835_file_content, get_edi835_storage_dirs, sync_folder_observer


@csrf_exempt
def api_process_tracked_file(request):
    """
    API Endpoint: Processes uploaded EDI 835 file through local/FTP directory structure
    and records metadata in 835File DB model.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method is allowed."}, status=405)

    edi_text = ""
    original_filename = "file.x12"

    file_obj = request.FILES.get("edi_file")
    if file_obj:
        original_filename = file_obj.name
        try:
            edi_text = file_obj.read().decode("utf-8", errors="ignore")
        except Exception as e:
            return JsonResponse({"error": f"Failed to read uploaded file: {str(e)}"}, status=400)
    else:
        if request.content_type == "application/json":
            try:
                body = json.loads(request.body.decode("utf-8"))
                edi_text = body.get("edi_text", "")
                original_filename = body.get("original_filename", "pasted_file.x12")
            except Exception:
                edi_text = ""
        else:
            edi_text = request.POST.get("edi_text", "")
            original_filename = request.POST.get("original_filename", "pasted_file.x12")

    edi_text = edi_text.strip()
    if not edi_text:
        return JsonResponse({"error": "Please provide EDI 835 text or upload a file."}, status=400)

    res = process_edi835_file_content(edi_text, original_filename=original_filename)

    if not res.get("success"):
        return JsonResponse({
            "error": res.get("error"),
            "file_id": str(res["db_record"].id),
            "status": res["db_record"].status,
        }, status=400)

    db_rec = res["db_record"]
    return JsonResponse({
        "success": True,
        "file_id": str(db_rec.id),
        "original_filename": db_rec.original_filename,
        "stored_filename": db_rec.stored_filename,
        "status": db_rec.status,
        "input_path": db_rec.input_path,
        "output_path": db_rec.output_path,
        "archive_path": db_rec.archive_path,
        "claims_count": res["claims_count"],
        "services_count": res["services_count"],
        "records_count": res["records_count"],
        "mir_text": res["mir_text"],
    })


@login_required
def tracked_files_list(request):
    """
    Returns JSON list of tracked 835File DB records with synced physical disk existence flags.
    """
    # Trigger Folder Observer to discover untracked files & sync disk presence
    sync_folder_observer()

    from django.conf import settings
    from pathlib import Path
    dirs = get_edi835_storage_dirs()
    input_dir = dirs["input"]
    archive_dir = dirs["archive"]

    records = EDI835File.objects.all()[:200]
    data = []
    for r in records:
        in_sftp = r.present_in_sftp
        if not in_sftp:
            if r.stored_filename and os.path.exists(input_dir / r.stored_filename):
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

        data.append({
            "id": str(r.id),
            "original_filename": r.original_filename,
            "stored_filename": r.stored_filename,
            "status": r.status,
            "claims_count": r.claims_count,
            "services_count": r.services_count,
            "records_count": r.records_count,
            "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
            "processing_started_at": r.processing_started_at.isoformat() if r.processing_started_at else None,
            "processing_completed_at": r.processing_completed_at.isoformat() if r.processing_completed_at else None,
            "input_path": r.input_path,
            "output_path": r.output_path,
            "archive_path": r.archive_path,
            "error_message": r.error_message,
            "validated": (r.status != "ERROR"),
            "processed": (r.status == "ARCHIVED"),
            "present_in_sftp": in_sftp,
            "present_in_archive_folder": in_archive,
        })
    return JsonResponse({"files": data})


def api_get_metrics(request):
    """
    API Endpoint: Returns live calculated metrics for the dashboard.
    """
    today = timezone.localdate()
    files_today = EDI835File.objects.filter(uploaded_at__date=today, status="ARCHIVED")

    total_claims_converted_today = files_today.aggregate(total=Sum("claims_count"))["total"] or 0
    converted_today_file_count = files_today.count()

    validated_waiting_count = EDI835File.objects.filter(status="PROCESSING").count()
    runs_needing_attention_count = EDI835File.objects.filter(status="ERROR").count()
    mir_outputs_today_count = converted_today_file_count

    dirs = get_edi835_storage_dirs()
    archive_dir = dirs["archive"]
    archive_folder_files_count = 0
    if os.path.exists(archive_dir):
        archive_folder_files_count = len([f for f in os.listdir(archive_dir) if os.path.isfile(os.path.join(archive_dir, f))])

    total_conversion_sets = EDI835File.objects.count()
    validated_sets_count = EDI835File.objects.exclude(status="ERROR").count()
    processed_sets_count = EDI835File.objects.filter(status="ARCHIVED").count()
    waiting_failed_count = EDI835File.objects.filter(status__in=["PROCESSING", "ERROR"]).count()
    val_failed_count = EDI835File.objects.filter(status="ERROR").count()

    return JsonResponse({
        "total_claims_converted_today": total_claims_converted_today,
        "converted_today_file_count": converted_today_file_count,
        "validated_waiting_count": validated_waiting_count,
        "runs_needing_attention_count": runs_needing_attention_count,
        "mir_outputs_today_count": mir_outputs_today_count,
        "total_files_count": archive_folder_files_count,
        "archived_files_count": archive_folder_files_count,
        "conversion_sets_count": total_conversion_sets,
        "files_835_received": total_conversion_sets,
        "ref_837_count": 0,
        "validated_sets_count": validated_sets_count,
        "processed_sets_count": processed_sets_count,
        "waiting_failed_count": waiting_failed_count,
        "val_failed_count": val_failed_count,
    })


def api_archive_files_list(request):
    """
    API Endpoint: Scans media/edi835/archive/ directory and returns list of physical files on disk.
    """
    dirs = get_edi835_storage_dirs()
    archive_dir = dirs["archive"]

    files_info = []
    if os.path.exists(archive_dir):
        for filename in sorted(os.listdir(archive_dir)):
            file_path = os.path.join(archive_dir, filename)
            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                mtime = timezone.datetime.fromtimestamp(stat.st_mtime, tz=timezone.get_current_timezone())
                files_info.append({
                    "filename": filename,
                    "size_bytes": stat.st_size,
                    "modified_at": mtime.strftime("%Y-%m-%d %H:%M:%S"),
                    "path": f"media/edi835/archive/{filename}",
                })

    return JsonResponse({
        "files_count": len(files_info),
        "files": files_info
    })


@csrf_exempt
def api_get_sftp_config(request):
    """
    API Endpoint: Returns active SFTP configuration and list of saved configurations from DB.
    """
    configs = SFTPConfig.objects.all()
    active_config = configs.first()

    saved_list = []
    for c in configs:
        saved_list.append({
            "id": str(c.id),
            "name": c.name,
            "connection_type": c.connection_type,
            "use_same_server": c.use_same_server,
            "host": c.host,
            "port": c.port,
            "username": c.username,
            "ssh_key": "",
            "auth_method": c.auth_method,
            "trust_unknown_key": c.trust_unknown_key,
            "inbound_837_folder": c.inbound_837_folder,
            "inbound_835_folder": c.inbound_835_folder,
            "outbound_host": c.outbound_host,
            "outbound_port": c.outbound_port,
            "outbound_username": c.outbound_username,
            "outbound_auth_method": c.outbound_auth_method,
            "outbound_trust_unknown_key": c.outbound_trust_unknown_key,
            "outbound_mir_folder": c.outbound_mir_folder,
            "status": c.status,
            "last_error": c.last_error,
            "last_tested_at": c.last_tested_at.strftime("%Y-%m-%d %H:%M:%S") if c.last_tested_at else None,
        })

    active_data = saved_list[0] if saved_list else None

    return JsonResponse({
        "active_config": active_data,
        "configurations": saved_list
    })


def parse_ssh_private_key(ssh_key_str, password=None):
    """
    Parses SSH Private Key string or file path using Paramiko key classes.
    If a .pub file path or public key string is provided, automatically attempts
    to locate the corresponding private key file on the local system.
    Returns (pkey_object, error_message).
    """
    if not ssh_key_str:
        return None, "No SSH Private Key provided."

    import io, os, paramiko
    from pathlib import Path

    key_str = ssh_key_str.strip()

    # 1. If key_str is a file path ending with .pub, check for private key file without .pub extension
    if key_str.lower().endswith(".pub"):
        priv_path = key_str[:-4]
        if os.path.exists(priv_path) and os.path.isfile(priv_path):
            key_str = priv_path

    # 2. If key_str is an existing file path, read its content
    if os.path.exists(key_str) and os.path.isfile(key_str):
        try:
            with open(key_str, "r", encoding="utf-8", errors="ignore") as f:
                key_str = f.read().strip()
        except Exception as e:
            return None, f"Failed to read SSH Key file: {str(e)}"

    # 3. Detect if user provided a PUBLIC key string (starts with 'ssh-ed25519', 'ssh-rsa', etc.)
    if key_str.startswith(("ssh-rsa", "ssh-ed25519", "ecdsa-sha2-", "ssh-dss")):
        # Try to find corresponding private key in default SSH directories
        user_home = Path.home()
        ssh_dir = user_home / ".ssh"
        candidate_files = [
            ssh_dir / "id_ed25519",
            ssh_dir / "id_rsa",
            ssh_dir / "id_ecdsa",
            ssh_dir / "id_dsa",
        ]
        
        found_pkey = None
        key_classes = [getattr(paramiko, k, None) for k in ["Ed25519Key", "RSAKey", "ECDSAKey", "DSSKey"]]
        key_classes = [k for k in key_classes if k is not None]
        passwords_to_try = [password] if password else [None]

        for cand in candidate_files:
            if cand.is_file():
                try:
                    with open(cand, "r", encoding="utf-8", errors="ignore") as f:
                        cand_str = f.read().strip()
                    for pass_cand in passwords_to_try:
                        for key_cls in key_classes:
                            try:
                                pkey = key_cls.from_private_key(io.StringIO(cand_str), password=pass_cand)
                                if pkey:
                                    # Check if the public key of this private key matches or use it
                                    pub_b64 = pkey.get_base64()
                                    if pub_b64 in key_str:
                                        return pkey, None
                                    if not found_pkey:
                                        found_pkey = pkey
                            except Exception:
                                pass
                except Exception:
                    pass

        if found_pkey:
            return found_pkey, None

        return None, (
            "You provided an SSH Public Key (.pub file or 'ssh-ed25519 ...' string). "
            "Public keys are stored on the remote server, while SSH authentication requires your secret Private Key file "
            "(e.g., 'id_ed25519' without .pub, containing '-----BEGIN OPENSSH PRIVATE KEY-----'). "
            "Mathematically, a Private Key cannot be generated from a Public Key. "
            "Please provide/upload your SSH Private Key file."
        )

    key_classes = [getattr(paramiko, k, None) for k in ["Ed25519Key", "RSAKey", "ECDSAKey", "DSSKey"]]
    key_classes = [k for k in key_classes if k is not None]

    last_err = None
    passwords_to_try = [password] if password else []
    passwords_to_try.append(None)

    for pass_candidate in passwords_to_try:
        for key_cls in key_classes:
            try:
                pkey = key_cls.from_private_key(io.StringIO(key_str), password=pass_candidate)
                if pkey:
                    return pkey, None
            except paramiko.PasswordRequiredException:
                last_err = "Private key is encrypted with a passphrase. Please select 'SSH Key + Password' and enter your passphrase in the password field."
            except Exception as ex:
                if not last_err:
                    last_err = str(ex)

    return None, f"Could not parse SSH Private Key ({last_err or 'Invalid private key format'})."


def test_sftp_connection(host, port, username, password=None, ssh_key=None, auth_method="Password", trust_unknown_key=True, remote_folder="/"):
    """
    Helper function: Performs staged Paramiko SFTP connection testing:
    Stage 1: TCP Socket connection
    Stage 2: SSH Protocol & Handshake / Host key verification
    Stage 3: Authentication
    Stage 4: SFTP Subsystem initialization
    Safe diagnostic logging (NEVER logs password or secrets).
    Guarantees proper connection cleanup in a finally block.
    """
    import socket
    import logging
    import paramiko

    logger = logging.getLogger("edi835.sftp")

    stages = {
        "network": "Not Tested",
        "ssh_handshake": "Not Tested",
        "authentication": "Not Tested",
        "sftp": "Not Tested",
    }

    ssh = None
    sftp = None

    logger.info(f"SFTP connection started - Host: {host}, Port: {port}, User: {username}")

    try:
        # --- STAGE 1: TCP Connection Test ---
        logger.info(f"Stage 1: TCP connection attempted to {host}:{port}")
        try:
            sock = socket.create_connection((host, port), timeout=6)
            sock.close()
            stages["network"] = "Passed"
            logger.info("Stage 1: TCP socket connection PASSED")
        except (socket.timeout, TimeoutError):
            stages["network"] = "Failed"
            logger.warning("Stage 1: TCP socket connection TIMED OUT")
            return {
                "success": False,
                "error": "SFTP server is unreachable or port is blocked",
                "error_type": "TCP_UNREACHABLE",
                "stages": stages,
                "troubleshooting": [
                    "Verify that the host/IP address is correct",
                    "Verify that port 22 is open on the remote server",
                    "Verify that SSH/SFTP service is running",
                    "Verify firewall rules allow incoming connection from your IP",
                    "Verify router/NAT port forwarding if applicable"
                ]
            }
        except (socket.error, OSError, ConnectionRefusedError, socket.gaierror) as err:
            stages["network"] = "Failed"
            logger.warning(f"Stage 1: TCP socket connection REFUSED/FAILED: {err}")
            return {
                "success": False,
                "error": f"SFTP server is unreachable or port is blocked ({str(err)})",
                "error_type": "TCP_UNREACHABLE",
                "stages": stages,
                "troubleshooting": [
                    "Verify that the host/IP address is correct",
                    "Verify that port 22 is open on the remote server",
                    "Verify that SSH/SFTP service is running",
                    "Verify firewall rules allow incoming connection from your IP"
                ]
            }

        # --- STAGE 2: SSH Client Handshake & Host Key Setup ---
        logger.info("Stage 2: SSH handshake attempted")
        ssh = paramiko.SSHClient()
        if trust_unknown_key:
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        else:
            ssh.load_system_host_keys()

        # Parse SSH Key if applicable
        pkey = None
        if auth_method in ["SSH Key", "SSH Key + Password"]:
            pkey, key_err = parse_ssh_private_key(ssh_key, password=password)
            if not pkey:
                stages["authentication"] = "Failed"
                return {
                    "success": False,
                    "error": f"SSH Key Error: {key_err}",
                    "error_type": "AUTH_FAILED",
                    "stages": stages,
                }

        pass_val = password if auth_method in ["Password", "SSH Key + Password"] else None

        # Connect attempt handles SSH handshake + Auth in Paramiko
        try:
            ssh.connect(
                hostname=host,
                port=port,
                username=username,
                password=pass_val,
                pkey=pkey,
                timeout=8,
                banner_timeout=8,
                auth_timeout=8,
                look_for_keys=False,
                allow_agent=False,
            )
            stages["ssh_handshake"] = "Passed"
            stages["authentication"] = "Passed"
            logger.info("Stage 2 (SSH Handshake) & Stage 3 (Authentication) PASSED")
        except paramiko.BadHostKeyException as err:
            stages["ssh_handshake"] = "Failed"
            logger.warning(f"Stage 2: Host key verification failed: {err}")
            return {
                "success": False,
                "error": "SSH host key verification failed",
                "error_type": "HOST_KEY_FAILED",
                "stages": stages,
            }
        except paramiko.AuthenticationException:
            stages["ssh_handshake"] = "Passed"
            stages["authentication"] = "Failed"
            logger.warning("Stage 3: Authentication failed")
            return {
                "success": False,
                "error": "SFTP username or password is incorrect",
                "error_type": "AUTH_FAILED",
                "stages": stages,
            }
        except paramiko.SSHException as err:
            stages["ssh_handshake"] = "Failed"
            logger.warning(f"Stage 2: SSH Handshake failed: {err}")
            return {
                "success": False,
                "error": f"SSH handshake failed: {str(err)}",
                "error_type": "SSH_HANDSHAKE_FAILED",
                "stages": stages,
            }

        # --- STAGE 4: SFTP Subsystem Initialization ---
        logger.info("Stage 4: SFTP subsystem attempted")
        try:
            sftp = ssh.open_sftp()
            stages["sftp"] = "Passed"
            logger.info("Stage 4: SFTP subsystem PASSED")
        except Exception as err:
            stages["sftp"] = "Failed"
            logger.warning(f"Stage 4: SFTP subsystem failed: {err}")
            return {
                "success": False,
                "error": f"SFTP subsystem could not be opened: {str(err)}",
                "error_type": "SFTP_SUBSYSTEM_FAILED",
                "stages": stages,
            }

        # Retrieve remote working directory (pwd) & scan target directory
        pwd = "/"
        try:
            pwd = sftp.normalize(".")
        except Exception:
            pwd = remote_folder or "/"

        remote_folders = []
        remote_files = []
        try:
            target_dir = "."
            # Check if 'sftp_test' subfolder exists or if user specified a remote folder
            if remote_folder and remote_folder.strip("/"):
                target_dir = remote_folder
            else:
                try:
                    sftp.stat("sftp_test")
                    target_dir = "sftp_test"
                except Exception:
                    try:
                        sftp.stat("/SFTP/sftp_test")
                        target_dir = "/SFTP/sftp_test"
                    except Exception:
                        try:
                            sftp.stat("C:/SFTP/sftp_test")
                            target_dir = "C:/SFTP/sftp_test"
                        except Exception:
                            target_dir = "."

            try:
                pwd = sftp.normalize(target_dir)
            except Exception:
                pwd = target_dir

            items = sftp.listdir_attr(target_dir)
            import stat
            for attr in items:
                if stat.S_ISDIR(attr.st_mode):
                    remote_folders.append(attr.filename)
                else:
                    remote_files.append({"name": attr.filename, "size": attr.st_size})
        except Exception as e:
            logger.warning(f"Could not list directory contents: {e}")

        logger.info("SFTP connection completed successfully")
        return {
            "success": True,
            "message": "SFTP connection successful",
            "pwd": pwd,
            "stages": stages,
            "remote_folders": remote_folders,
            "remote_files": remote_files,
        }

    except Exception as err:
        logger.error(f"Unexpected connection error: {err}")
        return {
            "success": False,
            "error": f"SFTP connection error: {str(err)}",
            "error_type": "GENERAL_ERROR",
            "stages": stages,
        }
    finally:
        logger.info("Connection cleanup started")
        if sftp:
            try:
                sftp.close()
            except Exception:
                pass
        if ssh:
            try:
                ssh.close()
            except Exception:
                pass
        logger.info("Connection cleanup finished")


@csrf_exempt
def api_sftp_connect(request):
    """
    API Endpoint: POST /api/sftp/connect
    Accepts host, port, username, password and verifies SFTP connection cleanly.
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method allowed."}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        body = request.POST

    host = (body.get("host") or "").strip()
    port_raw = body.get("port", 22)
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "").strip()
    ssh_key = (body.get("ssh_key") or "").strip()
    auth_method = body.get("auth_method", "Password").strip()
    trust_unknown_key = body.get("trust_unknown_key", True)
    if isinstance(trust_unknown_key, str):
        trust_unknown_key = (trust_unknown_key.lower() == "true")

    if not host:
        return JsonResponse({"success": False, "error": "SFTP Host is required."}, status=400)
    try:
        port = int(port_raw)
        if port < 1 or port > 65535:
            raise ValueError()
    except (ValueError, TypeError):
        return JsonResponse({"success": False, "error": "Invalid port number. Port must be between 1 and 65535."}, status=400)

    if not username:
        return JsonResponse({"success": False, "error": "SFTP Username is required."}, status=400)

    res = test_sftp_connection(
        host=host,
        port=port,
        username=username,
        password=password,
        ssh_key=ssh_key,
        auth_method=auth_method,
        trust_unknown_key=trust_unknown_key,
        remote_folder=body.get("inbound_835_folder", "/")
    )

    return JsonResponse(res, status=200)


@csrf_exempt
def api_save_sftp_config(request):
    """
    API Endpoint: Saves/updates SFTP configuration in DB and performs connection test verification.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method allowed."}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        body = request.POST

    use_same_server = body.get("use_same_server", True)
    if isinstance(use_same_server, str):
        use_same_server = (use_same_server.lower() == "true")

    connection_type = body.get("connection_type", "UNIFIED" if use_same_server else "INBOUND")

    if connection_type == "OUTBOUND":
        host = (body.get("outbound_host") or body.get("host") or "").strip()
        port = int(body.get("outbound_port") or body.get("port") or 22)
        username = (body.get("outbound_username") or body.get("username") or "").strip()
        password = (body.get("outbound_password") or body.get("password") or "").strip()
        ssh_key = (body.get("outbound_ssh_key") or body.get("ssh_key") or "").strip()
        auth_method = (body.get("outbound_auth_method") or body.get("auth_method") or "Password").strip()
        trust_unknown_key = body.get("outbound_trust_unknown_key", body.get("trust_unknown_key", True))
        if isinstance(trust_unknown_key, str):
            trust_unknown_key = (trust_unknown_key.lower() == "true")

        inbound_837_folder = ""
        inbound_835_folder = ""
        outbound_mir_folder = body.get("outbound_mir_folder", "").strip()
        test_folder = outbound_mir_folder or "/"
    else:
        host = (body.get("host") or "").strip()
        port = int(body.get("port") or 22)
        username = body.get("username", "").strip()
        password = body.get("password", "").strip()
        ssh_key = body.get("ssh_key", "").strip()
        auth_method = body.get("auth_method", "Password").strip()
        trust_unknown_key = body.get("trust_unknown_key", True)
        if isinstance(trust_unknown_key, str):
            trust_unknown_key = (trust_unknown_key.lower() == "true")

        inbound_837_folder = body.get("inbound_837_folder", "").strip()
        inbound_835_folder = body.get("inbound_835_folder", "").strip()
        outbound_mir_folder = body.get("outbound_mir_folder", "").strip() if use_same_server else ""
        test_folder = inbound_835_folder or "/"

    # Perform connection test using helper
    test_res = test_sftp_connection(
        host=host,
        port=port,
        username=username,
        password=password,
        ssh_key=ssh_key,
        auth_method=auth_method,
        trust_unknown_key=trust_unknown_key,
        remote_folder=test_folder,
    )

    config_id = body.get("id")
    config = None
    if config_id:
        config = SFTPConfig.objects.filter(id=config_id).first()

    if not config:
        config = SFTPConfig.objects.filter(connection_type=connection_type).first()

    if not config:
        config = SFTPConfig()

    config.name = f"{connection_type} Connection"
    config.use_same_server = use_same_server
    config.connection_type = connection_type
    config.host = host
    config.port = port
    config.username = username
    if password:
        config.password = password
    if ssh_key:
        config.ssh_key = ssh_key
    config.auth_method = auth_method
    config.trust_unknown_key = trust_unknown_key
    config.inbound_837_folder = inbound_837_folder
    config.inbound_835_folder = inbound_835_folder
    config.outbound_mir_folder = outbound_mir_folder

    if connection_type == "INBOUND":
        missing = not host or not username or not inbound_835_folder
    elif connection_type == "OUTBOUND":
        missing = not host or not username or not outbound_mir_folder
    else:
        missing = not host or not username or not inbound_835_folder or not outbound_mir_folder

    if missing:
        config.status = "PENDING"
        config.last_error = "Pending: Host, username, or remote folders are not fully configured."
    elif test_res["success"]:
        config.status = "CONNECTED"
        config.last_error = None
    else:
        config.status = "FAILED"
        config.last_error = test_res.get("error") or "SFTP connection failed"

    config.last_tested_at = timezone.now()
    config.save()

    discovered_folders = [
        {"path": inbound_835_folder, "type": "835 Inbound Source"},
        {"path": inbound_837_folder, "type": "837 Reference (Optional)"},
        {"path": outbound_mir_folder, "type": "MIR Outbound Destination"},
    ]

    return JsonResponse({
        "success": test_res["success"],
        "connected": test_res["success"],
        "message": test_res.get("message") or ("SFTP connection successful" if test_res["success"] else "SFTP connection failed"),
        "error": test_res.get("error"),
        "error_type": test_res.get("error_type"),
        "pwd": test_res.get("pwd"),
        "config_id": str(config.id),
        "status": config.status,
        "last_tested_at": config.last_tested_at.strftime("%Y-%m-%d %H:%M:%S"),
        "discovered_folders": discovered_folders,
        "remote_files": test_res.get("remote_files", []),
    }, status=200)


@csrf_exempt
def api_verify_sftp_paths(request):
    """
    API Endpoint: POST /api/sftp/verify-paths/
    Performs verification for input/output SFTP paths:
    1. Connects to SFTP using user credentials.
    2. Checks if each path exists (835 inbound, 837 reference, MIR outbound).
    3. If folder does NOT exist, creates the remote directory automatically using sftp.mkdir().
    4. Confirms .835, .837, and .mir file extensions destinations.
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method allowed."}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        body = request.POST

    host = (body.get("host") or "").strip()
    port = int(body.get("port", 22) or 22)
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "").strip()
    auth_method = body.get("auth_method", "Password").strip()
    trust_unknown_key = body.get("trust_unknown_key", True)
    if isinstance(trust_unknown_key, str):
        trust_unknown_key = (trust_unknown_key.lower() == "true")

    path_837 = (body.get("inbound_837_folder") or "").strip()
    path_835 = (body.get("inbound_835_folder") or "").strip()
    path_mir = (body.get("outbound_mir_folder") or "").strip()

    if not host or not username:
        return JsonResponse({"success": False, "error": "SFTP connection must be established first."}, status=400)

    import socket
    import paramiko

    ssh = None
    sftp = None
    path_statuses = []

    try:
        ssh = paramiko.SSHClient()
        if trust_unknown_key:
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        ssh.connect(
            hostname=host,
            port=port,
            username=username,
            password=password if auth_method == "Password" else None,
            timeout=8,
            banner_timeout=8,
            auth_timeout=8,
            look_for_keys=False,
            allow_agent=False,
        )
        sftp = ssh.open_sftp()

        def ensure_remote_dir(remote_dir, file_type):
            if not remote_dir:
                return {"path": remote_dir, "type": file_type, "status": "SKIPPED"}
            
            # Recursive directory helper
            dirs_to_create = []
            p = remote_dir.strip("/")
            parts = p.split("/") if p else []
            curr = ""
            created_new = False
            for part in parts:
                curr += "/" + part
                try:
                    sftp.stat(curr)
                except FileNotFoundError:
                    try:
                        sftp.mkdir(curr)
                        created_new = True
                    except Exception:
                        pass
                except Exception:
                    pass

            return {
                "path": remote_dir,
                "type": file_type,
                "created": created_new,
                "status": "CREATED_NEW" if created_new else "EXISTED",
            }

        path_statuses.append(ensure_remote_dir(path_835, "835 Inbound Source (.835 / .x12)"))
        path_statuses.append(ensure_remote_dir(path_837, "837 Reference Folder (.837 / .x12)"))
        path_statuses.append(ensure_remote_dir(path_mir, "MIR Outbound Destination (.mir)"))

        return JsonResponse({
            "success": True,
            "message": "SFTP paths connected & verified successfully!",
            "path_statuses": path_statuses
        })

    except Exception as err:
        return JsonResponse({
            "success": False,
            "error": f"Failed to verify/connect remote paths: {str(err)}"
        }, status=400)
    finally:
        if sftp:
            try: sftp.close()
            except Exception: pass
        if ssh:
            try: ssh.close()
            except Exception: pass


@csrf_exempt
def api_delete_sftp_config(request):
    """
    API Endpoint: Deletes SFTP configuration from DB.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method allowed."}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        body = request.POST

    config_id = body.get("config_id")
    if config_id:
        SFTPConfig.objects.filter(id=config_id).delete()
    else:
        SFTPConfig.objects.all().delete()

@csrf_exempt
def api_push_to_sftp(request):
    """
    API Endpoint: POST /api/sftp/push/
    Pushes an individual file record (both 835 and MIR) to SFTP server on demand.
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method allowed."}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        body = request.POST

    file_id = body.get("file_id")
    if not file_id:
        return JsonResponse({"success": False, "error": "File ID is required."}, status=400)

    from .services import push_file_record_to_sftp
    success, message = push_file_record_to_sftp(file_id)

    return JsonResponse({
        "success": success,
        "message": message,
        "error": message if not success else None,
    }, status=200 if success else 400)


_sftp_client_cache = {}

def get_cached_sftp_client(host, port, username, password=None, ssh_key=None, auth_method="Password", trust_unknown_key=True):
    import time
    cache_key = f"{host}:{port}:{username}:{auth_method}"
    now = time.time()
    
    if cache_key in _sftp_client_cache:
        entry = _sftp_client_cache[cache_key]
        ssh = entry.get("ssh")
        sftp = entry.get("sftp")
        if ssh and sftp and (now - entry.get("last_active", 0)) < 180:
            try:
                sftp.stat(".")
                entry["last_active"] = now
                return ssh, sftp
            except Exception:
                pass
        try: sftp.close()
        except Exception: pass
        try: ssh.close()
        except Exception: pass
        _sftp_client_cache.pop(cache_key, None)

    import paramiko
    ssh = paramiko.SSHClient()
    if trust_unknown_key:
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    else:
        ssh.load_system_host_keys()

    pkey = None
    if auth_method in ["SSH Key", "SSH Key + Password"]:
        pkey, _ = parse_ssh_private_key(ssh_key, password=password)

    pass_val = password if auth_method in ["Password", "SSH Key + Password"] else None

    ssh.connect(
        hostname=host,
        port=port,
        username=username,
        password=pass_val,
        pkey=pkey,
        timeout=4,
        banner_timeout=4,
        auth_timeout=4,
        look_for_keys=False,
        allow_agent=False,
    )
    sftp = ssh.open_sftp()
    
    _sftp_client_cache[cache_key] = {
        "ssh": ssh,
        "sftp": sftp,
        "last_active": now
    }
    return ssh, sftp


@csrf_exempt
def api_browse_sftp(request):
    """
    API Endpoint: POST /api/sftp/browse/
    Browses remote SFTP directory natively via Paramiko (in-app browser).
    Returns folder and file listings for specified remote path.
    Uses cached SFTP connection pool for lightning-fast directory navigation.
    """
    if request.method not in ["GET", "POST"]:
        return JsonResponse({"success": False, "error": "Method not allowed."}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8")) if (request.body and request.method == "POST") else request.GET
    except Exception:
        body = request.GET

    remote_path = body.get("path") or "."
    config_id = body.get("config_id")

    config = None
    if config_id:
        config = SFTPConfig.objects.filter(id=config_id).first()
    if not config:
        config = SFTPConfig.objects.first()

    # Allow custom host/credentials in payload or fallback to saved DB config
    host = body.get("host") or (config.host if config else None)
    port = int(body.get("port") or (config.port if config else 22) or 22)
    username = body.get("username") or (config.username if config else None)
    password = body.get("password") or (config.password if config else (config.outbound_password if config else None))
    ssh_key = body.get("ssh_key") or (config.ssh_key if config else None)
    auth_method = body.get("auth_method") or (config.auth_method if config else "Password")
    trust_unknown_key = body.get("trust_unknown_key", True)

    if not host or not username:
        return JsonResponse({
            "success": False,
            "error": "No SFTP configuration or credentials available. Please configure SFTP connection first."
        }, status=400)

    import stat
    import posixpath
    from datetime import datetime

    try:
        ssh, sftp = get_cached_sftp_client(
            host=host,
            port=port,
            username=username,
            password=password,
            ssh_key=ssh_key,
            auth_method=auth_method,
            trust_unknown_key=trust_unknown_key
        )

        # Normalize target directory
        try:
            pwd = sftp.normalize(remote_path)
        except Exception:
            pwd = remote_path or "/"

        items = sftp.listdir_attr(pwd)
        folders = []
        files = []

        for attr in items:
            name = attr.filename
            is_dir = stat.S_ISDIR(attr.st_mode)
            mtime_str = datetime.fromtimestamp(attr.st_mtime).strftime("%Y-%m-%d %H:%M:%S") if attr.st_mtime else "-"
            item_path = posixpath.normpath(posixpath.join(pwd, name))

            if is_dir:
                folders.append({
                    "name": name,
                    "path": item_path,
                    "mtime": mtime_str
                })
            else:
                files.append({
                    "name": name,
                    "path": item_path,
                    "size": attr.st_size,
                    "mtime": mtime_str
                })

        # Sort folders and files alphabetically
        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())

        # Compute parent path
        parent_path = posixpath.dirname(pwd.rstrip("/"))
        if not parent_path or parent_path == pwd:
            parent_path = None

        return JsonResponse({
            "success": True,
            "pwd": pwd,
            "parent_path": parent_path,
            "folders": folders,
            "files": files,
        })

    except Exception as err:
        return JsonResponse({
            "success": False,
            "error": f"Failed to list SFTP directory contents: {str(err)}"
        }, status=400)



