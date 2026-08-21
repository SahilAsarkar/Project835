from django.urls import path
from . import views

urlpatterns = [
    path('mappings/', views.mappings_view, name='mappings_view'),
    path('mappings/check/', views.mappings_check, name='mappings_check'),
    path('mappings/reset/', views.mappings_reset, name='mappings_reset'),
    path('convert/', views.convert, name='convert'),
    path('download/<str:artifact_id>/', views.download, name='download'),
]
