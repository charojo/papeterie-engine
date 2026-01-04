import logging
from datetime import datetime
from pathlib import Path


# Global Server Logger
def setup_server_logger(log_dir: Path):
    log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("papeterie")
    logger.setLevel(logging.INFO)

    # File Handler
    fh = logging.FileHandler(log_dir / "server.log")
    fh.setLevel(logging.INFO)

    # Console Handler
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)

    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    fh.setFormatter(formatter)
    ch.setFormatter(formatter)

    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger


class AssetLogger:
    def __init__(self, assets_dir: Path):
        self.assets_dir = assets_dir

    def clear_logs(self, asset_type: str, asset_name: str, user_id: str = "default"):
        """
        Clears the log file for a specific asset.
        """
        try:
            asset_dir = self.assets_dir / "users" / user_id / asset_type / asset_name
            if not asset_dir.exists():
                return
            log_file = asset_dir / f"{asset_name}.log"
            if log_file.exists():
                log_file.unlink()
        except Exception as e:
            logging.getLogger("papeterie").error(f"Failed to clear logs for {asset_name}: {e}")

    def log_action(
        self,
        asset_type: str,
        asset_name: str,
        action: str,
        message: str,
        details: str = None,
        user_id: str = "default",
    ):
        """
        Logs an action to the specific asset's log file.
        asset_type: 'sprites' or 'scenes'
        """
        try:
            asset_dir = self.assets_dir / "users" / user_id / asset_type / asset_name
            if not asset_dir.exists():
                return  # Should not log to non-existent asset

            log_file = asset_dir / f"{asset_name}.log"

            timestamp = datetime.now().isoformat()
            log_entry = f"[{timestamp}] {action.upper()}: {message}"
            if details:
                log_entry += f"\nDetails: {details}"
            log_entry += "\n" + "-" * 40 + "\n"

            with open(log_file, "a", encoding="utf-8") as f:
                f.write(log_entry)

        except Exception as e:
            # Fallback to server log if asset logging fails
            logging.getLogger("papeterie").error(f"Failed to write asset log for {asset_name}: {e}")

    def log_info(self, asset_type: str, asset_name: str, message: str, user_id: str = "default"):
        """
        Logs a simple informational message to the asset's log file.
        Useful for granular progress updates.
        """
        try:
            asset_dir = self.assets_dir / "users" / user_id / asset_type / asset_name
            if not asset_dir.exists():
                return

            log_file = asset_dir / f"{asset_name}.log"
            timestamp = datetime.now().strftime("%H:%M:%S")
            log_entry = f"[{timestamp}] INFO: {message}\n"

            with open(log_file, "a", encoding="utf-8") as f:
                f.write(log_entry)

        except Exception as e:
            logging.getLogger("papeterie").error(
                f"Failed to write asset info log for {asset_name}: {e}"
            )

    def get_logs(self, asset_type: str, asset_name: str, user_id: str = "default") -> str:
        try:
            log_file = (
                self.assets_dir / "users" / user_id / asset_type / asset_name / f"{asset_name}.log"
            )
            if log_file.exists():
                return log_file.read_text(encoding="utf-8")
            return "No logs found."
        except Exception as e:
            return f"Error reading logs: {str(e)}"
