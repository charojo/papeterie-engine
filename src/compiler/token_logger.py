import csv
import os
from datetime import datetime

LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "token_ledger.csv")

# Pricing per 1M tokens (USD)
# Using generic fallback for unknown models
PRICING = {
    "gemini-2.5-flash": {"input": 0.10, "output": 0.40},  # Using 1.5 Flash pricing as proxy
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-pro": {"input": 3.50, "output": 10.50},
    "gemini-3-flash-preview": {"input": 0.10, "output": 0.40},  # Estimate
    "gemini-3-pro-image-preview": {"input": 3.50, "output": 10.50},  # Estimate
    "default": {"input": 0.10, "output": 0.40},
}


def calculate_cost(
    model_name: str, prompt_tokens: int | None, candidate_tokens: int | None
) -> float:
    """Calculates estimated cost in USD based on model pricing."""
    rates = PRICING.get(model_name, PRICING["default"])

    p_tokens = prompt_tokens or 0
    c_tokens = candidate_tokens or 0

    input_cost = (p_tokens / 1_000_000) * rates["input"]
    output_cost = (c_tokens / 1_000_000) * rates["output"]

    return input_cost + output_cost


def log_token_usage(
    model_name: str,
    prompt_tokens: int | None,
    candidate_tokens: int | None,
    total_tokens: int | None,
    task_name: str = "compiler",
):
    """
    Appends token usage metadata to a CSV ledger including estimated cost.
    """
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)

    file_exists = os.path.isfile(LOG_FILE)

    # Sanitize inputs (handle None from API)
    p_tokens = prompt_tokens or 0
    c_tokens = candidate_tokens or 0
    t_tokens = total_tokens or (p_tokens + c_tokens)

    estimated_cost = calculate_cost(model_name, p_tokens, c_tokens)

    with open(LOG_FILE, mode="a", newline="") as csvfile:
        fieldnames = [
            "timestamp",
            "task_name",
            "model",
            "prompt_tokens",
            "candidate_tokens",
            "total_tokens",
            "estimated_cost",
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        if not file_exists:
            writer.writeheader()

        # Note: If file exists but header is missing 'estimated_cost', DictWriter handles
        # it gracefully by just writing the value (CSV doesn't enforce schema on append).
        # However, for consistency, we might ideally migrate. For now, we append.

        writer.writerow(
            {
                "timestamp": datetime.now().isoformat(),
                "task_name": task_name,
                "model": model_name,
                "prompt_tokens": p_tokens,
                "candidate_tokens": c_tokens,
                "total_tokens": t_tokens,
                "estimated_cost": f"{estimated_cost:.6f}",
            }
        )
