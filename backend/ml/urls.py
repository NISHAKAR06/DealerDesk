"""
URL routing for the `ml` Django Application (Track 2 — AI Assistant & Demand Forecasting).
"""

from django.urls import path
from . import views

urlpatterns = [
    # Forecasting & Reorder API (§10)
    path("reorder-suggestions/", views.reorder_suggestions, name="reorder-suggestions"),
    path("forecast/<str:sku>/", views.sku_forecast, name="sku-forecast"),

    # Dealer Assistant API (§9)
    path("assistant/chat/", views.assistant_chat, name="assistant-chat"),
]

