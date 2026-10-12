from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Load the files in data/ into the database. Must be safe to run more than once."

    def handle(self, *args, **options):
        data_dir = settings.DATA_DIR  # <repo root>/data
        # TODO: load data_dir / "catalogue.csv" and data_dir / "dealers.csv",
        # plus anything else your app needs. Running this twice must not create duplicates.
        self.stdout.write(self.style.WARNING(f"seed_data is not implemented yet (data folder: {data_dir})"))
