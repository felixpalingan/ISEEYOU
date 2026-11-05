from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, List
from engine.models.entities import EntityNode, EntityEdge, VulnerabilityFinding, EntityType


class BaseOSINTProvider(ABC):
    """
    Abstract Base Class for all ISEEYOU Reconnaissance Workers
    """
    def __init__(self, name: str, supported_types: List[EntityType]):
        self.name = name
        self.supported_types = supported_types

    def can_handle(self, entity_type: EntityType) -> bool:
        return entity_type in self.supported_types

    @abstractmethod
    async def execute(
        self, target: str, target_type: EntityType
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes the reconnaissance pipeline and yields telemetry events:
        - {"type": "log", "message": "...", "level": "info"}
        - {"type": "node", "data": EntityNode(...)}
        - {"type": "edge", "data": EntityEdge(...)}
        - {"type": "vuln", "data": VulnerabilityFinding(...)}
        """
        pass
