from django.urls import path
from .views import (
    signup_view,
    login_view,
    logout_view,
    totp_setup_view,
    totp_verify_view,
    api_user_info,
    api_login,
    api_signup,
    api_totp_setup,
    api_totp_verify,
    api_logout,
)

urlpatterns = [
    path("signup/", signup_view, name="signup"),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("totp/setup/", totp_setup_view, name="totp_setup"),
    path("totp/verify/", totp_verify_view, name="totp_verify"),
    path("api/user/", api_user_info, name="api_user_info"),
    path("api/login/", api_login, name="api_login"),
    path("api/signup/", api_signup, name="api_signup"),
    path("api/totp/setup/", api_totp_setup, name="api_totp_setup"),
    path("api/totp/verify/", api_totp_verify, name="api_totp_verify"),
    path("api/logout/", api_logout, name="api_logout"),
]

