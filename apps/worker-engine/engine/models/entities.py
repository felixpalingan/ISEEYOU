from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime


class EntityType(str, Enum):
    DOMAIN = "domain"
    SUBDOMAIN = "subdomain"
    IP = "ip"
    EMAIL = "email"
    USERNAME = "username"
    PHONE = "phone"
    ARCHIVE = "archive"
    BREACH = "breach"
    PORT = "port"
    SECRET = "secret"
    DOCUMENT = "document"
    ASSOCIATE = "associate"
    ORGANIZATION = "organization"
    LOCATION = "location"


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


# Deterministic risk weight matrix matching packages/shared-types/src/risk.ts
RISK_WEIGHTS: Dict[SeverityLevel, int] = {
    SeverityLevel.CRITICAL: 35,
    SeverityLevel.HIGH: 20,
    SeverityLevel.MEDIUM: 10,
    SeverityLevel.LOW: 5,
    SeverityLevel.INFO: 0,
}


def calculate_normalized_risk_score(
    findings: List[VulnerabilityFinding] | List[SeverityLevel],
) -> int:
    """
    Calculates deterministic risk score normalized between 0 and 100
    """
    if not findings:
        return 0
    total = 0
    for item in findings:
        severity = item.severity if isinstance(item, VulnerabilityFinding) else item
        total += RISK_WEIGHTS.get(severity, 0)
    return min(100, total)


class TelemetryLevel(str, Enum):
    INFO = "info"
    SUCCESS = "success"
    WARN = "warn"
    ERROR = "error"


class TelemetryLog(BaseModel):
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().strftime("%H:%M:%S")
    )
    module: str
    level: TelemetryLevel = TelemetryLevel.INFO
    message: str


class ProviderResultSummary(BaseModel):
    provider_name: str
    target: str
    nodes_discovered: int = 0
    edges_discovered: int = 0
    vulnerabilities_found: int = 0
    risk_score_impact: int = 0
    duration_ms: float = 0.0
    status: str = "success"


class ScanRequest(BaseModel):
    seed_input: str
    force_refresh: bool = False
    enabled_modules: Optional[List[str]] = None
    entity_type: Optional[EntityType] = None

    @field_validator("seed_input")
    @classmethod
    def validate_seed(cls, v: str) -> str:
        from engine.core.security import validate_target_security, SecurityValidationError
        try:
            return validate_target_security(v)
        except SecurityValidationError as e:
            raise ValueError(str(e))


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


class AttackChainStep(BaseModel):
    step: int
    title: str
    technique: str
    target_asset: str
    description: str
    impact: str


class PredictedLead(BaseModel):
    lead_type: str = "username"
    value: str
    reason: str
    confidence: float = 0.75


class SuggestedDork(BaseModel):
    title: str
    query: str
    category: str = "Cross-Platform Pivot"
    description: str = ""


class AIAnalysisRequest(BaseModel):
    target: str
    target_type: str
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)
    findings: List[Dict[str, Any]] = Field(default_factory=list)
    risk_score: float = 0.0
    ai_provider: Optional[str] = "gemini"
    api_key: Optional[str] = None
    model_override: Optional[str] = None


class AIAnalysisResponse(BaseModel):
    status: str = "success"
    model: str = "gemini-1.5-flash"
    target: str
    target_type: str
    executive_summary: str
    threat_level: str
    key_exposures: List[str] = Field(default_factory=list)
    attack_chain: List[AttackChainStep] = Field(default_factory=list)
    mitre_techniques: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    predicted_leads: List[PredictedLead] = Field(default_factory=list)
    suggested_dorks: List[SuggestedDork] = Field(default_factory=list)
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


