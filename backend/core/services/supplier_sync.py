import logging
import time
from decimal import Decimal, InvalidOperation
import requests
from django.conf import settings
from django.db import transaction

from core.exceptions import SupplierUnavailableError
from core.models import Product, SupplierSyncLog

logger = logging.getLogger(__name__)


class SupplierSyncService:
    @staticmethod
    def sync_catalogue() -> dict:
        """Executes a full, fault-tolerant catalogue synchronization against the external supplier API."""
        supplier_url = (getattr(settings, "SUPPLIER_API_URL", "") or "http://127.0.0.1:8099").rstrip("/")
        api_key = getattr(settings, "SUPPLIER_API_KEY", "") or ""

        if not supplier_url:
            raise SupplierUnavailableError(message="SUPPLIER_API_URL is not configured.")

        session = requests.Session()
        headers = {"X-Api-Key": api_key, "Accept": "application/json"}

        raw_items = []
        cursor = None
        pages_fetched = 0
        requests_made = 0

        # Step 1: Paginate and fetch all items with retries
        while True:
            params = {"limit": 20}
            if cursor:
                params["cursor"] = cursor

            page_data = None
            max_attempts = 5
            attempt = 0

            while attempt < max_attempts:
                attempt += 1
                requests_made += 1
                try:
                    resp = session.get(
                        f"{supplier_url}/v1/products",
                        params=params,
                        headers=headers,
                        timeout=20,
                    )
                    if resp.status_code == 200:
                        page_data = resp.json()
                        pages_fetched += 1
                        break
                    elif resp.status_code == 401:
                        logger.error("Supplier sync rejected: Unauthorized (401)")
                        raise SupplierUnavailableError(message="Supplier authentication failed (401 Unauthorized).")
                    elif resp.status_code == 429:
                        retry_after = 1
                        try:
                            retry_after = max(1, int(resp.headers.get("Retry-After", 1)))
                        except (ValueError, TypeError):
                            retry_after = 1
                        time.sleep(min(retry_after, 5))
                    elif resp.status_code in (500, 502, 503, 504):
                        time.sleep(0.5 * attempt)
                    else:
                        time.sleep(0.5 * attempt)
                except requests.RequestException as e:
                    logger.warning("Supplier sync network error attempt %d/%d: %s", attempt, max_attempts, e)
                    time.sleep(0.5 * attempt)

            if page_data is None:
                raise SupplierUnavailableError(
                    message=f"Failed to fetch supplier page after {max_attempts} attempts."
                )

            items_batch = page_data.get("items", [])
            raw_items.extend(items_batch)
            cursor = page_data.get("next_cursor")
            if not cursor:
                break

        # Step 2: Validate and filter items
        rejected_list = []
        valid_items_by_sku = {}

        for item in raw_items:
            supplier_sku = item.get("supplier_sku") or item.get("sku") or "UNKNOWN"
            sku = (item.get("sku") or "").strip()
            if not sku:
                rejected_list.append({
                    "supplier_sku": supplier_sku,
                    "reason": "missing or empty sku",
                })
                continue

            raw_price = item.get("price")
            try:
                price_dec = Decimal(str(raw_price or "").strip())
                if price_dec <= Decimal("0.00"):
                    rejected_list.append({
                        "supplier_sku": supplier_sku,
                        "reason": "price must be strictly positive",
                    })
                    continue
                # Validate at most 2 decimal places
                parts = str(raw_price).split(".")
                if len(parts) > 1 and len(parts[1]) > 2:
                    rejected_list.append({
                        "supplier_sku": supplier_sku,
                        "reason": "price exceeds 2 decimal places",
                    })
                    continue
                valid_price = price_dec.quantize(Decimal("0.01"))
            except (InvalidOperation, TypeError):
                rejected_list.append({
                    "supplier_sku": supplier_sku,
                    "reason": "invalid price format",
                })
                continue

            # Check duplicates across pages: keep latest updated_at
            updated_at = item.get("updated_at") or ""
            if sku in valid_items_by_sku:
                existing_updated_at = valid_items_by_sku[sku].get("updated_at") or ""
                if updated_at > existing_updated_at:
                    valid_items_by_sku[sku] = {
                        **item,
                        "price_dec": valid_price,
                    }
            else:
                valid_items_by_sku[sku] = {
                    **item,
                    "price_dec": valid_price,
                }

        # Step 3: Apply changes atomically to database
        created_count = 0
        updated_count = 0
        unchanged_count = 0

        with transaction.atomic():
            existing_products = {
                p.sku: p for p in Product.objects.filter(sku__in=valid_items_by_sku.keys())
            }

            for sku, s_item in valid_items_by_sku.items():
                name = (s_item.get("name") or "").strip()
                category = (s_item.get("category") or "").strip()
                brand = (s_item.get("brand") or "").strip()
                vehicle_fitment = (s_item.get("vehicle_fitment") or "").strip()
                description = (s_item.get("description") or "").strip()
                price = s_item["price_dec"]

                if sku not in existing_products:
                    Product.objects.create(
                        sku=sku,
                        name=name,
                        category=category,
                        brand=brand,
                        vehicle_fitment=vehicle_fitment,
                        description=description,
                        price=price,
                        stock=0,  # Never adopt supplier stock; internal stock defaults to 0
                    )
                    created_count += 1
                else:
                    prod = existing_products[sku]
                    differs = (
                        prod.name != name or
                        prod.category != category or
                        prod.brand != brand or
                        prod.vehicle_fitment != vehicle_fitment or
                        prod.description != description or
                        prod.price != price
                    )
                    if differs:
                        prod.name = name
                        prod.category = category
                        prod.brand = brand
                        prod.vehicle_fitment = vehicle_fitment
                        prod.description = description
                        prod.price = price
                        prod.save(update_fields=[
                            "name", "category", "brand", "vehicle_fitment", "description", "price"
                        ])
                        updated_count += 1
                    else:
                        unchanged_count += 1

            SupplierSyncLog.objects.create(
                created_count=created_count,
                updated_count=updated_count,
                unchanged_count=unchanged_count,
                rejected_count=len(rejected_list),
                pages_fetched=pages_fetched,
                requests_made=requests_made,
            )

        return {
            "created": created_count,
            "updated": updated_count,
            "unchanged": unchanged_count,
            "rejected": rejected_list,
            "pages_fetched": pages_fetched,
            "requests_made": requests_made,
        }

