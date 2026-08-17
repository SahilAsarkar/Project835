from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.utils import timezone
from django.db.models import Sum
from edi835.models import EDI835File


@login_required
def home_view(request):
    user = request.user

    # TOTP setup hasn't been completed
    if not user.totp_enabled:
        return redirect("totp_setup")

    # TOTP hasn't been verified during this login
    if not request.session.get("totp_verified", False):
        return redirect("totp_verify")

    # Uses localdate() based on settings.TIME_ZONE. Automatically resets counters to 0 when date rolls over to next day.
    today = timezone.localdate()
    files_today = EDI835File.objects.filter(uploaded_at__date=today, status="ARCHIVED")

    total_claims_converted_today = files_today.aggregate(total=Sum("claims_count"))["total"] or 0
    converted_today_file_count = files_today.count()

    validated_waiting_count = EDI835File.objects.filter(status="PROCESSING").count()
    runs_needing_attention_count = EDI835File.objects.filter(status="ERROR").count()
    mir_outputs_today_count = converted_today_file_count

    import os
    from edi835.services import get_edi835_storage_dirs
    dirs = get_edi835_storage_dirs()
    archive_dir = dirs["archive"]
    total_files_count = len([f for f in os.listdir(archive_dir) if os.path.isfile(os.path.join(archive_dir, f))]) if os.path.exists(archive_dir) else 0

    recent_files = EDI835File.objects.order_by("-uploaded_at")[:10]

    context = {
        "today_date_str": today.strftime("%Y-%m-%d"),
        "total_claims_converted_today": total_claims_converted_today,
        "converted_today_file_count": converted_today_file_count,
        "validated_waiting_count": validated_waiting_count,
        "runs_needing_attention_count": runs_needing_attention_count,
        "mir_outputs_today_count": mir_outputs_today_count,
        "total_files_count": total_files_count,
        "recent_files": recent_files,
    }

    return render(request, "home/index.html", context)
