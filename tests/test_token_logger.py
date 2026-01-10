import csv
from unittest.mock import patch

from src.compiler.token_logger import calculate_cost, log_token_usage


def test_calculate_cost():
    assert calculate_cost("gemini-1.5-flash", 1000000, 1000000) == 0.075 + 0.30
    assert calculate_cost("unknown", 1000000, 1000000) == 0.10 + 0.40


def test_log_token_usage_new_file(tmp_path):
    log_dir = tmp_path / "logs"
    log_file = log_dir / "token_ledger.csv"

    with patch("src.compiler.token_logger.LOG_DIR", str(log_dir)):
        with patch("src.compiler.token_logger.LOG_FILE", str(log_file)):
            log_token_usage("gemini-1.5-flash", 100, 200, 300, "test_task")

            assert log_file.exists()
            with open(log_file, "r") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                assert len(rows) == 1
                assert rows[0]["task_name"] == "test_task"
                assert rows[0]["model"] == "gemini-1.5-flash"
                assert int(rows[0]["prompt_tokens"]) == 100
                assert int(rows[0]["candidate_tokens"]) == 200
                assert int(rows[0]["total_tokens"]) == 300


def test_log_token_usage_existing_file(tmp_path):
    log_dir = tmp_path / "logs"
    log_file = log_dir / "token_ledger.csv"
    log_dir.mkdir()

    with open(log_file, "w") as f:
        f.write(
            "timestamp,task_name,model,prompt_tokens,candidate_tokens,total_tokens,estimated_cost\n"
        )

    with patch("src.compiler.token_logger.LOG_DIR", str(log_dir)):
        with patch("src.compiler.token_logger.LOG_FILE", str(log_file)):
            log_token_usage("gemini-1.5-flash", 100, 200, 300, "test_task")

            with open(log_file, "r") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                assert len(rows) == 1
