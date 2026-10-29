import os

os.environ["SHELF_SKIP_WATCH"] = "1"
os.environ.pop("DATABASE_URL", None)
os.environ.pop("REDIS_URL", None)
