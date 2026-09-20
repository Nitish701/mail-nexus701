from pydantic import BaseModel, Field


class Attachment(BaseModel):
	filename: str | None = None
	content_type: str
	size: int = Field(ge=0)
	disposition: str | None = None


class AuthenticationCheck(BaseModel):
	status: str
	reason: str
	score: int = Field(ge=0)


class LayerCheck(BaseModel):
	status: str
	score: int = Field(ge=0)
	probability: float | None = None
	findings: list[str] = Field(default_factory=list)
	reason: str | None = None


class IOCFingerprint(BaseModel):
	kind: str
	value: str
	sha256: str


class EmailFingerprint(BaseModel):
	redacted_body: str
	body_sha256: str
	tlsh: str | None = None
	pii_redactions: dict[str, int]
	iocs: list[IOCFingerprint] = Field(default_factory=list)


class ThreatAdvisory(BaseModel):
	status: str
	summary: str
	recommended_actions: list[str] = Field(default_factory=list)
	json_export: dict[str, object]
	csv: str


class InboundEmailResponse(BaseModel):
	message_id: str | None = None
	from_address: str | None = None
	to_addresses: list[str]
	subject: str | None = None
	headers: dict[str, list[str]]
	urls: list[str]
	attachments: list[Attachment]
	authentication: dict[str, AuthenticationCheck]
	heuristic_findings: list[str]
	layers: dict[str, LayerCheck]
	virustotal: dict[str, object]
	fingerprint: EmailFingerprint
	threat_advisory: ThreatAdvisory
	base_score: int = Field(ge=0, le=70)
	report_id: str | None = None
