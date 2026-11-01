"""JoinWitness deterministic Commerce vertical slice (frozen contract commerce.v1).

Isolated namespace for the G2-B01 four-CSV investigation. No import here may
mutate Case A (event) modules; the commerce engine depends only on the Python
standard library.
"""

COMMERC_VERSION = "commerce.v1"
RECEIPT_FORMAT = "jw.commerce.receipt.v1"
ENGINE_IDENTITY = "jw-commerce-g2-b01-v1"
PREDICATE = "clean_fulfilled_count >= K"

__all__ = [
    "COMMERC_VERSION",
    "ENGINE_IDENTITY",
    "PREDICATE",
    "RECEIPT_FORMAT",
]
