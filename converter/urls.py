from django.urls import path
from .views import api_convert, api_validate, download_mir, api_get_file_content
from edi835.views import api_sftp_connect

urlpatterns = [
    path("api/convert/", api_convert, name="api_convert"),
    path("api/validate/", api_validate, name="api_validate"),
    path("api/download/", download_mir, name="download_mir"),
    path("api/file-content/<str:file_id>/", api_get_file_content, name="api_get_file_content"),
    path("api/sftp/connect", api_sftp_connect, name="api_sftp_connect_root_direct"),
    path("api/sftp/connect/", api_sftp_connect, name="api_sftp_connect_direct"),
]

