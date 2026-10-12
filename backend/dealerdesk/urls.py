from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    # Add your apps' URLs here, e.g. path("api/", include("orders.urls")),
]
