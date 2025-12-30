import os
import csv
from datetime import datetime

LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "token_ledger.csv")

def log_token_usage(model_name: str, prompt_tokens: int, candidate_tokens: int, total_tokens: int, task_name: str = "compiler"):
    """
    Appends token usage metadata to a CSV ledger.
    """
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)

    file_exists = os.path.isfile(LOG_FILE)

    with open(LOG_FILE, mode='a', newline='') as csvfile:
        fieldnames = ['timestamp', 'task_name', 'model', 'prompt_tokens', 'candidate_tokens', 'total_tokens']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        if not file_exists:
            writer.writeheader()

        writer.writerow({
            'timestamp': datetime.now().isoformat(),
            'task_name': task_name,
            'model': model_name,
            'prompt_tokens': prompt_tokens,
            'candidate_tokens': candidate_tokens,
            'total_tokens': total_tokens
        })
