import base64
import io
import secrets

import pyotp
import qrcode

from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect

from .forms import SignupForm, LoginForm


def signup_view(request):
    if request.user.is_authenticated:
        return redirect("home")

    if request.method == "POST":
        form = SignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            request.session["totp_setup_required"] = True
            return redirect("totp_setup")
    else:
        form = SignupForm()

    return render(request, "accounts/signup.html", {"form": form})


def login_view(request):
    if request.user.is_authenticated:
        if not request.user.totp_enabled:
            return redirect("totp_setup")
        if not request.session.get("totp_verified", False):
            return redirect("totp_verify")
        return redirect("home")

    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            user = form.user
            login(request, user)
            if not user.totp_enabled:
                request.session["totp_setup_required"] = True
                return redirect("totp_setup")

            request.session["totp_verified"] = False
            return redirect("totp_verify")
    else:
        form = LoginForm()

    return render(request, "accounts/login.html", {"form": form})


@login_required
def totp_setup_view(request):
    user = request.user
    if user.totp_enabled:
        return redirect("home")

    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        user.save(update_fields=["totp_secret"])

    secret = user.totp_secret
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="Project835")

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image()

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_code = base64.b64encode(buffer.getvalue()).decode()

    if request.method == "POST":
        code = request.POST.get("code", "").strip()
        if totp.verify(code):
            user.totp_enabled = True
            recovery_codes = [secrets.token_hex(4).upper() for _ in range(10)]
            user.recovery_codes = recovery_codes
            user.save(update_fields=["totp_enabled", "recovery_codes"])

            request.session["totp_verified"] = True
            request.session["totp_setup_required"] = False
            messages.success(request, "Authenticator successfully configured.")

            return render(
                request,
                "accounts/totp_setup.html",
                {
                    "qr_code": qr_code,
                    "secret": secret,
                    "verified": True,
                    "recovery_codes": recovery_codes,
                },
            )
        else:
            messages.error(request, "Invalid authenticator code.")

    return render(
        request,
        "accounts/totp_setup.html",
        {
            "qr_code": qr_code,
            "secret": secret,
            "verified": False,
        },
    )


@login_required
def totp_verify_view(request):
    user = request.user
    if not user.totp_enabled:
        return redirect("totp_setup")

    if request.session.get("totp_verified", False):
        return redirect("home")

    if request.method == "POST":
        code = request.POST.get("code", "").strip()
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(code):
            request.session["totp_verified"] = True
            messages.success(request, "Authentication successful.")
            return redirect("home")

        messages.error(request, "Invalid authenticator code.")

    return render(request, "accounts/totp_verify.html")


def logout_view(request):
    logout(request)
    return redirect("login")


from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

def api_user_info(request):
    if not request.user.is_authenticated:
        return JsonResponse({
            "authenticated": False,
            "user": None
        })

    return JsonResponse({
        "authenticated": True,
        "user": {
            "name": getattr(request.user, "name", request.user.email),
            "email": request.user.email,
            "totp_enabled": getattr(request.user, "totp_enabled", False),
            "totp_verified": request.session.get("totp_verified", False)
        }
    })

@csrf_exempt
def api_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        data = request.POST

    form = LoginForm(data)
    if form.is_valid():
        user = form.user
        login(request, user)
        if not user.totp_enabled:
            request.session["totp_setup_required"] = True
            return JsonResponse({
                "success": True,
                "next": "totp_setup",
                "totp_enabled": False,
                "totp_verified": False,
                "user": {"name": getattr(user, "name", user.email), "email": user.email}
            })

        request.session["totp_verified"] = False
        return JsonResponse({
            "success": True,
            "next": "totp_verify",
            "totp_enabled": True,
            "totp_verified": False,
            "user": {"name": getattr(user, "name", user.email), "email": user.email}
        })

    errors = []
    if form.non_field_errors():
        errors.extend(form.non_field_errors())
    for field, field_errs in form.errors.items():
        if field != "__all__":
            errors.extend(field_errs)

    return JsonResponse({
        "success": False,
        "error": errors[0] if errors else "Invalid login credentials."
    }, status=400)

@csrf_exempt
def api_signup(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        data = request.POST

    form = SignupForm(data)
    if form.is_valid():
        user = form.save()
        login(request, user)
        request.session["totp_setup_required"] = True
        return JsonResponse({
            "success": True,
            "next": "totp_setup",
            "user": {"name": getattr(user, "name", user.email), "email": user.email}
        })

    field_errors = {}
    for field, err_list in form.errors.items():
        field_errors[field] = err_list[0] if err_list else "Invalid value."

    return JsonResponse({
        "success": False,
        "errors": field_errors,
        "error": form.non_field_errors()[0] if form.non_field_errors() else "Registration failed. Please check inputs."
    }, status=400)

@csrf_exempt
@login_required
def api_totp_setup(request):
    user = request.user
    if user.totp_enabled and not request.session.get("totp_setup_required", False):
        return JsonResponse({"verified": True, "already_configured": True})

    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        user.save(update_fields=["totp_secret"])

    secret = user.totp_secret
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="Project835")

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image()

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_code = base64.b64encode(buffer.getvalue()).decode()

    if request.method == "POST":
        try:
            data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
        except Exception:
            data = request.POST

        code = data.get("code", "").strip()
        if totp.verify(code):
            user.totp_enabled = True
            recovery_codes = [secrets.token_hex(4).upper() for _ in range(10)]
            user.recovery_codes = recovery_codes
            user.save(update_fields=["totp_enabled", "recovery_codes"])

            request.session["totp_verified"] = True
            request.session["totp_setup_required"] = False

            return JsonResponse({
                "success": True,
                "verified": True,
                "recovery_codes": recovery_codes,
                "message": "Authenticator successfully configured."
            })
        else:
            return JsonResponse({"success": False, "error": "Invalid authenticator code."}, status=400)

    return JsonResponse({
        "success": True,
        "qr_code": qr_code,
        "secret": secret,
        "verified": False,
    })

@csrf_exempt
@login_required
def api_totp_verify(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed."}, status=405)

    user = request.user
    if not user.totp_enabled:
        return JsonResponse({"error": "2FA setup required."}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
    except Exception:
        data = request.POST

    code = data.get("code", "").strip()
    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(code):
        request.session["totp_verified"] = True
        return JsonResponse({
            "success": True,
            "next": "home",
            "message": "Authentication successful."
        })

    return JsonResponse({"success": False, "error": "Invalid authenticator code."}, status=400)

@csrf_exempt
def api_logout(request):
    logout(request)
    return JsonResponse({"success": True})

