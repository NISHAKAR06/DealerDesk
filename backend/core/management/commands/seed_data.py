import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Dealer, Order, OrderLineItem, Product


class Command(BaseCommand):
    help = "Idempotently loads catalogue and dealer data from data/ CSV files into PostgreSQL in batch."

    def add_arguments(self, parser):
        parser.add_argument(
            "--data-dir",
            type=str,
            default=None,
            help="Optional path to directory containing CSV data files.",
        )

    def handle(self, *args, **options):
        # Resolve data directory
        data_dir_opt = options.get("data_dir")
        if data_dir_opt:
            data_dir = Path(data_dir_opt).resolve()
        elif hasattr(settings, "DATA_DIR") and settings.DATA_DIR.exists():
            data_dir = Path(settings.DATA_DIR).resolve()
        elif (settings.BASE_DIR / "data").exists():
            data_dir = (settings.BASE_DIR / "data").resolve()
        elif (settings.BASE_DIR.parent / "data").exists():
            data_dir = (settings.BASE_DIR.parent / "data").resolve()
        else:
            raise CommandError("Could not locate canonical 'data/' directory.")

        self.stdout.write(self.style.NOTICE(f"Using dataset directory: {data_dir}"))

        catalogue_path = data_dir / "catalogue.csv"
        dealers_path = data_dir / "dealers.csv"

        if not catalogue_path.exists():
            raise CommandError(f"Required catalogue dataset not found at {catalogue_path}")
        if not dealers_path.exists():
            raise CommandError(f"Required dealers dataset not found at {dealers_path}")

        with transaction.atomic():
            prod_created, prod_updated = self._seed_catalogue(catalogue_path)
            dealer_created, dealer_updated = self._seed_dealers(dealers_path)

        total_products = Product.objects.count()
        total_dealers = Dealer.objects.count()

        self.stdout.write(self.style.SUCCESS(
            f"\nSeeding complete:\n"
            f"  Products: {prod_created} created, {prod_updated} updated (Total in DB: {total_products})\n"
            f"  Dealers:  {dealer_created} created, {dealer_updated} updated (Total in DB: {total_dealers})"
        ))

    def _seed_catalogue(self, file_path: Path):
        existing_products = {p.sku: p for p in Product.objects.all()}
        to_create = []
        to_update = []
        seen_skus = set()

        with open(file_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            required_fields = {"sku", "name", "category", "brand", "vehicle_fitment", "price", "stock"}
            if not required_fields.issubset(set(reader.fieldnames or [])):
                missing = required_fields - set(reader.fieldnames or [])
                raise CommandError(f"catalogue.csv is missing required headers: {missing}")

            for row_num, row in enumerate(reader, start=2):
                sku = (row.get("sku") or "").strip()
                if not sku:
                    raise CommandError(f"catalogue.csv row {row_num}: Missing SKU")

                name = (row.get("name") or "").strip()
                category = (row.get("category") or "").strip()
                brand = (row.get("brand") or "").strip()
                vehicle_fitment = (row.get("vehicle_fitment") or "").strip()
                description = (row.get("description") or "").strip()

                try:
                    price = Decimal(str(row.get("price") or "").strip()).quantize(Decimal("0.01"))
                except (InvalidOperation, TypeError):
                    raise CommandError(f"catalogue.csv row {row_num}: Invalid price '{row.get('price')}'")

                try:
                    stock = int(str(row.get("stock") or "0").strip())
                    if stock < 0:
                        raise ValueError("stock must be >= 0")
                except (ValueError, TypeError):
                    raise CommandError(f"catalogue.csv row {row_num}: Invalid stock quantity '{row.get('stock')}'")

                if sku in existing_products:
                    prod = existing_products[sku]
                    prod.name = name
                    prod.category = category
                    prod.brand = brand
                    prod.vehicle_fitment = vehicle_fitment
                    prod.description = description
                    prod.price = price
                    prod.stock = stock
                    to_update.append(prod)
                else:
                    to_create.append(
                        Product(
                            sku=sku,
                            name=name,
                            category=category,
                            brand=brand,
                            vehicle_fitment=vehicle_fitment,
                            description=description,
                            price=price,
                            stock=stock,
                        )
                    )
                seen_skus.add(sku)

        if to_create:
            Product.objects.bulk_create(to_create, batch_size=500)
        if to_update:
            Product.objects.bulk_update(
                to_update,
                ["name", "category", "brand", "vehicle_fitment", "description", "price", "stock"],
                batch_size=500,
            )

        # Remove ephemeral test products created by test runners/smoke test
        stray_skus = set(existing_products.keys()) - seen_skus
        if stray_skus:
            OrderLineItem.objects.filter(product__sku__in=stray_skus).delete()
            Product.objects.filter(sku__in=stray_skus).delete()

        return len(to_create), len(to_update)

    def _seed_dealers(self, file_path: Path):
        existing_dealers = {d.dealer_code: d for d in Dealer.objects.all()}
        to_create = []
        to_update = []
        seen_dealer_codes = set()

        with open(file_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            required_fields = {"dealer_code", "name"}
            if not required_fields.issubset(set(reader.fieldnames or [])):
                missing = required_fields - set(reader.fieldnames or [])
                raise CommandError(f"dealers.csv is missing required headers: {missing}")

            for row_num, row in enumerate(reader, start=2):
                dealer_code = (row.get("dealer_code") or "").strip()
                if not dealer_code:
                    raise CommandError(f"dealers.csv row {row_num}: Missing dealer_code")

                name = (row.get("name") or "").strip()
                city = (row.get("city") or "").strip()
                phone = (row.get("phone") or "").strip()
                email = (row.get("email") or "").strip()
                gstin = (row.get("gstin") or "").strip()

                credit_limit_str = (row.get("credit_limit") or "0.00").strip()
                try:
                    credit_limit = Decimal(credit_limit_str).quantize(Decimal("0.01"))
                except (InvalidOperation, TypeError):
                    credit_limit = Decimal("0.00")

                if dealer_code in existing_dealers:
                    dealer = existing_dealers[dealer_code]
                    dealer.name = name
                    dealer.city = city
                    dealer.phone = phone
                    dealer.email = email
                    dealer.gstin = gstin
                    dealer.credit_limit = credit_limit
                    to_update.append(dealer)
                else:
                    to_create.append(
                        Dealer(
                            dealer_code=dealer_code,
                            name=name,
                            city=city,
                            phone=phone,
                            email=email,
                            gstin=gstin,
                            credit_limit=credit_limit,
                        )
                    )
                seen_dealer_codes.add(dealer_code)

        if to_create:
            Dealer.objects.bulk_create(to_create, batch_size=500)
        if to_update:
            Dealer.objects.bulk_update(
                to_update,
                ["name", "city", "phone", "email", "gstin", "credit_limit"],
                batch_size=500,
            )

        # Remove ephemeral test dealers created by test runners/smoke test
        stray_dealers = set(existing_dealers.keys()) - seen_dealer_codes
        if stray_dealers:
            OrderLineItem.objects.filter(order__dealer__dealer_code__in=stray_dealers).delete()
            Order.objects.filter(dealer__dealer_code__in=stray_dealers).delete()
            Dealer.objects.filter(dealer_code__in=stray_dealers).delete()

        return len(to_create), len(to_update)
