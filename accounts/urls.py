from django.urls import path
from .views import (
    signup_view,
    login_view,
    logout_view,
    totp_setup_view,
    totp_verify_view,
)

urlpatterns = [
    path("signup/", signup_view, name="signup"),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("totp/setup/", totp_setup_view, name="totp_setup"),
    path("totp/verify/", totp_verify_view, name="totp_verify"),
]
