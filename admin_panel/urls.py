from django.urls import path
from .views import (
    api_admin_clients,
    api_admin_create_client,
    api_admin_update_client,
    api_admin_delete_client,
    api_admin_users,
    api_admin_create_user,
    api_admin_update_user,
    api_admin_delete_user,
    api_admin_access_info,
    api_admin_stats,
)

urlpatterns = [
    path("api/clients/", api_admin_clients, name="admin_api_clients"),
    path("api/clients", api_admin_clients),
    path("api/clients/create/", api_admin_create_client, name="admin_api_create_client"),
    path("api/clients/create", api_admin_create_client),
    path("api/clients/<uuid:client_id>/update/", api_admin_update_client, name="admin_api_update_client"),
    path("api/clients/<uuid:client_id>/delete/", api_admin_delete_client, name="admin_api_delete_client"),
    path("api/users/", api_admin_users, name="admin_api_users"),
    path("api/users", api_admin_users),
    path("api/users/create/", api_admin_create_user, name="admin_api_create_user"),
    path("api/users/create", api_admin_create_user),
    path("api/users/<int:user_id>/update/", api_admin_update_user, name="admin_api_update_user"),
    path("api/users/<int:user_id>/delete/", api_admin_delete_user, name="admin_api_delete_user"),
    path("api/access/info/", api_admin_access_info, name="admin_api_access_info"),
    path("api/access/info", api_admin_access_info),
    path("api/stats/", api_admin_stats, name="admin_api_stats"),
    path("api/stats", api_admin_stats),
]
