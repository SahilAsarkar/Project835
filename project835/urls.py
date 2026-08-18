from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect


def root_redirect(request):
    if request.user.is_authenticated:
        if not request.user.totp_enabled:
            return redirect("totp_setup")
        if not request.session.get("totp_verified", False):
            return redirect("totp_verify")
        return redirect("home")
    return redirect("login")


from django.conf import settings
from django.conf.urls.static import static

from home.views import home_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("home/", include("home.urls")),
    path("edi835/", include("edi835.urls")),
    path("", include("converter.urls")),
    path("", home_view, name="root"),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

