from django.urls import path

from . import views

urlpatterns = [
    # Health check
    path("health/", views.health, name="health"),

    # Products API (§4)
    path("products/", views.product_list, name="product-list"),
    path("products/<str:sku>/", views.product_detail, name="product-detail"),

    # Inventory API (§5)
    path("inventory/<str:sku>/", views.inventory_adjust, name="inventory-adjust"),

    # Dealers API (§6)
    path("dealers/", views.dealer_list, name="dealer-list"),
    path("dealers/<str:pk>/", views.dealer_detail, name="dealer-detail"),

    # Orders API (§7)
    path("orders/", views.order_list, name="order-list"),
    path("orders/<str:order_number>/", views.order_detail, name="order-detail"),
    path("orders/<str:order_number>/confirm/", views.order_confirm, name="order-confirm"),
    path("orders/<str:order_number>/dispatch/", views.order_dispatch, name="order-dispatch"),
    path("orders/<str:order_number>/deliver/", views.order_deliver, name="order-deliver"),
    path("orders/<str:order_number>/cancel/", views.order_cancel, name="order-cancel"),

    # Supplier Sync API (§8)
    path("sync/supplier/", views.supplier_sync, name="supplier-sync"),
    path("sync/supplier/history/", views.supplier_sync_history, name="supplier-sync-history"),

    # Forecasting & Reorder API (§10)
    path("reorder-suggestions/", views.reorder_suggestions, name="reorder-suggestions"),
    path("forecast/<str:sku>/", views.sku_forecast, name="sku-forecast"),

    # Dealer Assistant API (§9)
    path("assistant/chat/", views.assistant_chat, name="assistant-chat"),
]
