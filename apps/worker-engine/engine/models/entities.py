from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime


class EntityType(str, Enum):
    DOMAIN = "domain"
    SUBDOMAIN = "subdomain"
    IP = "ip"
    EMAIL = "email"
    USERNAME = "username"
    BREACH = "breach"
    PORT = "port"
    SECRET = "secret"
    DOCUMENT = "document"


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class EntityNode(BaseModel):
    id: str
    type: EntityType
    value: str
    label: str
    severity: SeverityLevel = SeverityLevel.INFO
    metadata: Dict[str, Any] = Field(default_factory=dict)
    parent_id: Optional[str] = None
    is_cluster: bool = False
    cluster_count: Optional[int] = None
    discovered_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class EntityEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: str
    confidence: float = 1.0


class VulnerabilityFinding(BaseModel):
    id: str
    node_id: str
    title: str
    severity: SeverityLevel
    cve_id: Optional[str] = None
    evidence: str
    discovered_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ScanRequest(BaseModel):
    seed_input: str
    force_refresh: bool = False


class ScanStatusResponse(BaseModel):
    session_id: str
    seed_input: str
    seed_type: EntityType
    status: str
    risk_score: int
    nodes_count: int
    edges_count: int
    started_at: str
    completed_at: Optional[str] = None
