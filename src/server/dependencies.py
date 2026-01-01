from src.config import ASSETS_DIR
from src.server.logger import AssetLogger

# Singleton instance for use across routers
asset_logger = AssetLogger(ASSETS_DIR)
