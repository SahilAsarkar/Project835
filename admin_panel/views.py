import json
import logging
from django.db import models, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from accounts.models import Client, User
from edi835.models import EDI835File
from .models import OnboardingStepDefinition, ClientStepStatus, GoLiveStepDefinition, ClientGoLiveStatus, ClientTestEnvironment, AuditLog


@csrf_exempt
def api_admin_stats(request):
    """
    GET /admin-panel/api/stats/
    Returns admin metrics summary.
    """
    total_clients = Client.objects.count()
    active_clients = Client.objects.filter(status="ACTIVE").count()
    inactive_clients = Client.objects.filter(status="INACTIVE").count()
    total_users = User.objects.count()
    total_conversions = EDI835File.objects.count()

    return JsonResponse({
        "success": True,
        "total_clients": total_clients,
        "active_clients": active_clients,
        "inactive_clients": inactive_clients,
        "total_users": total_users,
        "total_conversions": total_conversions,
        "system_status": "OPERATIONAL"
    })


@csrf_exempt
def api_admin_clients(request):
    """
    GET /admin-panel/api/clients/  -> List clients
    POST /admin-panel/api/clients/ -> Create new client
    """
    if request.method == "POST":
        return api_admin_create_client(request)

    search_q = request.GET.get("search", "").strip()
    status_q = request.GET.get("status", "").strip()

    clients_qs = Client.objects.all().order_by("-created_at")

    if search_q:
        clients_qs = clients_qs.filter(
            models.Q(name__icontains=search_q) |
            models.Q(client_code__icontains=search_q) |
            models.Q(email__icontains=search_q) |
            models.Q(phone__icontains=search_q)
        )

    if status_q and status_q.upper() in ["ACTIVE", "INACTIVE"]:
        clients_qs = clients_qs.filter(status=status_q.upper())

    total_clients = Client.objects.count()
    active_clients = Client.objects.filter(status="ACTIVE").count()
    inactive_clients = Client.objects.filter(status="INACTIVE").count()

    clients_data = []
    for c in clients_qs:
        clients_data.append({
            "id": str(c.id),
            "name": c.name,
            "code": c.client_code,
            "client_code": c.client_code,
            "email": c.email,
            "phone": c.phone or "",
            "address": c.address or "",
            "status": c.status,
            "stage": c.stage,
            "claims_system": c.claims_system,
            "owner": c.owner,
            "progress_pct": c.progress_pct,
            "live_since": c.live_since.strftime("%Y-%m-%dT%H:%M:%SZ") if c.live_since else (c.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if c.created_at else None),
            "notes": c.notes or "",
            "users_count": c.users.count() if hasattr(c, "users") else 0,
            "created_at": c.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if c.created_at else "",
            "updated_at": c.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ") if c.updated_at else "",
        })

    return JsonResponse({
        "success": True,
        "results": clients_data,
        "clients": clients_data,
        "total_clients": total_clients,
        "active_clients": active_clients,
        "inactive_clients": inactive_clients,
    })


@csrf_exempt
def api_admin_create_client(request):
    """
    POST /admin-panel/api/clients/create/ or /admin-panel/api/clients/
    Creates a new client record in database.
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method is allowed."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        data = request.POST

    name = (data.get("name") or "").strip()
    client_code = (data.get("code") or data.get("client_code") or "").strip().upper()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()
    status = (data.get("status") or "ACTIVE").strip().upper()
    notes = (data.get("notes") or "").strip()
    claims_system = (data.get("claims_system") or "Vendor Hosted").strip()
    owner = (data.get("owner") or "System Admin").strip()
    stage = (data.get("stage") or "onboarding").strip().lower()

    if not name:
        return JsonResponse({"success": False, "error": "Client Name is required."}, status=400)

    if not client_code:
        last_count = Client.objects.count() + 1
        client_code = f"CLT-{last_count:04d}"

    # Auto generate client code if needed or add suffix if duplicate
    base_code = client_code
    counter = 1
    while Client.objects.filter(client_code=client_code).exists():
        client_code = f"{base_code}-{counter}"
        counter += 1

    if not email:
        safe_name = name.lower().replace(" ", "").replace(".", "")
        email = f"{safe_name}@client.com"

    if status not in ["ACTIVE", "INACTIVE"]:
        status = "ACTIVE"

    try:
        with transaction.atomic():
            client_obj = Client.objects.create(
                name=name,
                client_code=client_code,
                email=email,
                phone=phone,
                address=address,
                status=status,
                notes=notes,
                claims_system=claims_system,
                owner=owner,
                stage="onboarding_pending",
                progress_pct=0
            )

            # Initialize Sequential Onboarding Workflow
            onboarding_step_1 = OnboardingStepDefinition.objects.filter(step_number=1).first()
            if onboarding_step_1:
                ClientStepStatus.objects.create(
                    client=client_obj,
                    step=onboarding_step_1,
                    status='IN_PROGRESS'
                )

            # Initialize Pre-Flight / Go-Live Workflow
            golive_step_1 = GoLiveStepDefinition.objects.filter(step_number=1).first()
            if golive_step_1:
                ClientGoLiveStatus.objects.create(
                    client=client_obj,
                    step=golive_step_1,
                    status='IN_PROGRESS'
                )

            # Provision the Sandbox / Test Environment
            ClientTestEnvironment.objects.create(
                client=client_obj,
                sftp_host="sftp-test.internal",
                sftp_username=f"{client_obj.id}_sandbox",
                watched_folder=f"/inbound/{client_obj.id}_test",
                test_status="In Progress"
            )

            # Audit Logging
            current_admin = "System"
            if request.user and hasattr(request.user, "name") and request.user.name:
                current_admin = request.user.name
            elif request.user and hasattr(request.user, "email") and request.user.email:
                current_admin = request.user.email

            AuditLog.objects.create(
                module="CLIENTS",
                action="CLIENT_CREATED",
                details=f"Created new tenant '{client_obj.name}'.",
                performed_by=current_admin,
                client=client_obj
            )

            client_dict = {
                "id": str(client_obj.id),
                "name": client_obj.name,
                "code": client_obj.client_code,
                "client_code": client_obj.client_code,
                "email": client_obj.email,
                "phone": client_obj.phone or "",
                "address": client_obj.address or "",
                "status": client_obj.status,
                "stage": client_obj.stage,
                "claims_system": client_obj.claims_system,
                "owner": client_obj.owner,
                "progress_pct": client_obj.progress_pct,
                "live_since": client_obj.live_since.strftime("%Y-%m-%dT%H:%M:%SZ") if client_obj.live_since else (client_obj.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if client_obj.created_at else None),
                "notes": client_obj.notes or "",
                "created_at": client_obj.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if client_obj.created_at else "",
            }

            return JsonResponse({
                "success": True,
                "message": f"Client '{client_obj.name}' created successfully.",
                "client": client_dict,
                "data": client_dict,
            }, status=201)
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@csrf_exempt
def api_admin_update_client(request, client_id):
    """
    POST /admin-panel/api/clients/<client_id>/update/
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method is allowed."}, status=405)

    try:
        client_obj = Client.objects.get(id=client_id)
    except (Client.DoesNotExist, ValueError):
        return JsonResponse({"success": False, "error": "Client not found."}, status=404)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        data = request.POST

    if "name" in data:
        client_obj.name = data["name"].strip() or client_obj.name
    if "email" in data:
        client_obj.email = data["email"].strip().lower() or client_obj.email
    if "phone" in data:
        client_obj.phone = data["phone"].strip()
    if "address" in data:
        client_obj.address = data["address"].strip()
    if "notes" in data:
        client_obj.notes = data["notes"].strip()

    if "client_code" in data and data["client_code"].strip():
        new_code = data["client_code"].strip().upper()
        if new_code != client_obj.client_code and Client.objects.filter(client_code=new_code).exists():
            return JsonResponse({"success": False, "error": f"Client code '{new_code}' already exists."}, status=400)
        client_obj.client_code = new_code

    if "status" in data:
        st = data["status"].strip().upper()
        if st in ["ACTIVE", "INACTIVE"]:
            client_obj.status = st

    if "stage" in data:
        client_obj.stage = data["stage"].strip().lower()
    if "claims_system" in data:
        client_obj.claims_system = data["claims_system"].strip()
    if "owner" in data:
        client_obj.owner = data["owner"].strip()
    if "progress_pct" in data:
        try:
            client_obj.progress_pct = int(data["progress_pct"])
        except ValueError:
            pass
            
    client_obj.save()

    return JsonResponse({
        "success": True,
        "message": f"Client '{client_obj.name}' updated successfully.",
        "client": {
            "id": str(client_obj.id),
            "name": client_obj.name,
            "client_code": client_obj.client_code,
            "email": client_obj.email,
            "phone": client_obj.phone or "",
            "address": client_obj.address or "",
            "status": client_obj.status,
            "stage": client_obj.stage,
            "claims_system": client_obj.claims_system,
            "owner": client_obj.owner,
            "progress_pct": client_obj.progress_pct,
            "live_since": client_obj.live_since.strftime("%Y-%m-%dT%H:%M:%SZ") if client_obj.live_since else (client_obj.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if client_obj.created_at else None),
            "notes": client_obj.notes or "",
            "updated_at": client_obj.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ") if client_obj.updated_at else "",
        }
    })


@csrf_exempt
def api_admin_delete_client(request, client_id):
    """
    POST /admin-panel/api/clients/<client_id>/delete/
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method is allowed."}, status=405)

    try:
        client_obj = Client.objects.get(id=client_id)
        name = client_obj.name
        client_obj.delete()
        return JsonResponse({"success": True, "message": f"Client '{name}' deleted successfully."})
    except (Client.DoesNotExist, ValueError):
        return JsonResponse({"success": False, "error": "Client not found."}, status=404)


@csrf_exempt
def api_admin_access_info(request):
    """
    GET /admin-panel/api/access/info/
    Returns dynamic access control matrix from database users.
    """
    staff_list = []
    for u in User.objects.select_related("client").all().order_by("-created_at"):
        staff_list.append({
            "id": u.id,
            "person": u.name or u.email.split("@")[0],
            "email": u.email,
            "mobile": u.mobile or "—",
            "role": "Admin" if u.is_staff else "User",
            "access": "Full Access" if u.is_staff else "Standard Access",
            "clients": [u.client.name] if u.client else ["All Clients"],
            "mfa": "2FA TOTP Enabled" if u.totp_enabled else "Password Only",
            "last_login": u.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if u.created_at else "",
            "status": "Active" if u.is_active else "Inactive",
        })

    return JsonResponse({
        "success": True,
        "current_admin": {
            "name": "Sahil Asarkar",
            "role": "Super Admin",
            "mfa_status": "Enabled",
            "mfa_desc": "Hardware & TOTP Verified",
            "session_state": "Active",
            "session_desc": "30-min auto-expire",
        },
        "last_login": "2026-08-21T00:00:00Z",
        "staff": staff_list,
        "users": staff_list,
    })


@csrf_exempt
def api_admin_users(request):
    """
    GET /admin-panel/api/users/  -> List users
    POST /admin-panel/api/users/ -> Create user credentials
    """
    if request.method == "POST":
        return api_admin_create_user(request)

    search_q = request.GET.get("search", "").strip()
    users_qs = User.objects.select_related("client").all().order_by("-created_at")

    if search_q:
        users_qs = users_qs.filter(
            models.Q(name__icontains=search_q) |
            models.Q(email__icontains=search_q) |
            models.Q(mobile__icontains=search_q)
        )

    users_data = []
    for u in users_qs:
        users_data.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "mobile": u.mobile or "—",
            "is_active": u.is_active,
            "is_staff": u.is_staff,
            "totp_enabled": u.totp_enabled,
            "client_id": str(u.client.id) if u.client else None,
            "client_name": u.client.name if u.client else None,
            "client_code": u.client.client_code if u.client else None,
            "created_at": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else "",
        })

    return JsonResponse({
        "success": True,
        "total_users": User.objects.count(),
        "users": users_data,
        "results": users_data,
    })


@csrf_exempt
def api_admin_create_user(request):
    """
    POST /admin-panel/api/users/create/ or /admin-panel/api/users/
    Creates user credentials in database.
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method is allowed."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        data = request.POST

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    mobile = (data.get("mobile") or "").strip()
    password = data.get("password") or "Password@123"
    role = (data.get("role") or "").strip().lower()
    is_staff = bool(data.get("is_staff", False) or role in ["admin", "staff", "super admin"])
    client_id = data.get("client_id")
    client_ids = data.get("clients") or []

    if not name:
        return JsonResponse({"success": False, "error": "User Name is required."}, status=400)
    if not email:
        return JsonResponse({"success": False, "error": "User Email is required."}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({"success": False, "error": f"Email '{email}' is already registered in the system."}, status=400)

    if not mobile:
        count = User.objects.count() + 1000
        mobile = f"+1555{count:04d}"

    if User.objects.filter(mobile=mobile).exists():
        count = User.objects.count() + 2000
        mobile = f"+1555{count:04d}"

    client_obj = None
    target_cid = client_id or (client_ids[0] if isinstance(client_ids, list) and len(client_ids) > 0 else None)
    if target_cid:
        try:
            client_obj = Client.objects.get(id=target_cid)
        except Exception:
            client_obj = None

    user = User.objects.create_user(
        email=email,
        name=name,
        mobile=mobile,
        password=password,
        is_staff=is_staff,
        client=client_obj
    )

    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "mobile": user.mobile,
        "is_staff": user.is_staff,
        "role": "Admin" if user.is_staff else "User",
        "client_name": client_obj.name if client_obj else None,
    }

    return JsonResponse({
        "success": True,
        "message": f"User credentials for '{user.email}' created successfully in database.",
        "user": user_dict,
        "data": user_dict,
    })


@csrf_exempt
def api_admin_update_user(request, user_id):
    """
    POST /admin-panel/api/users/<user_id>/update/
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method is allowed."}, status=405)

    try:
        user_obj = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"success": False, "error": "User not found."}, status=404)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        data = request.POST

    if "name" in data and data["name"].strip():
        user_obj.name = data["name"].strip()
    if "mobile" in data and data["mobile"].strip():
        user_obj.mobile = data["mobile"].strip()
    if "password" in data and data["password"].strip():
        user_obj.set_password(data["password"].strip())
    if "is_active" in data:
        user_obj.is_active = bool(data["is_active"])
    if "is_staff" in data:
        user_obj.is_staff = bool(data["is_staff"])
    if "client_id" in data:
        cid = data["client_id"]
        if cid:
            try:
                user_obj.client = Client.objects.get(id=cid)
            except Exception:
                user_obj.client = None
        else:
            user_obj.client = None

    user_obj.save()

    return JsonResponse({
        "success": True,
        "message": f"User '{user_obj.email}' updated successfully."
    })


@csrf_exempt
def api_admin_delete_user(request, user_id):
    """
    POST /admin-panel/api/users/<user_id>/delete/
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Only POST method is allowed."}, status=405)

    try:
        user_obj = User.objects.get(id=user_id)
        email = user_obj.email
        user_obj.delete()
        return JsonResponse({"success": True, "message": f"User '{email}' deleted successfully."})
    except User.DoesNotExist:
        return JsonResponse({"success": False, "error": "User not found."}, status=404)
