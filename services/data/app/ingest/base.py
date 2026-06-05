from abc import ABC, abstractmethod
from typing import Any


class BaseSource(ABC):
    """All data sources implement this interface."""

    @abstractmethod
    def fetch_current(self) -> list[dict[str, Any]]:
        """Fetch the latest price snapshot for all tracked coins."""
        ...

    def get_tracked_coins(self) -> list[str]:
        """Return the list of coin IDs this source knows how to fetch."""
        return [
            "bitcoin", "ethereum", "solana", "binancecoin",
            "ripple", "cardano", "avalanche-2", "polkadot",
            "dogecoin", "shiba-inu",
        ]