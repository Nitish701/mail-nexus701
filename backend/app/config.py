from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[1]
# This is an uncalibrated-model review guardrail, not a phishing probability guarantee.
ML_REVIEW_PROBABILITY_THRESHOLD = float(os.getenv("MAIL_NEXUS_ML_REVIEW_THRESHOLD", "0.98"))
if not 0.0 <= ML_REVIEW_PROBABILITY_THRESHOLD <= 1.0:
    raise ValueError("MAIL_NEXUS_ML_REVIEW_THRESHOLD must be between 0 and 1")

# Maximum raw email payload size: 50 MiB by default.
MAX_EMAIL_BYTES = int(os.getenv("MAIL_NEXUS_MAX_EMAIL_BYTES", 50 * 1024 * 1024))
MODEL_PATH = Path(os.getenv("MAIL_NEXUS_MODEL_PATH", BASE_DIR / "models" / "body_model.joblib"))
BODY_MODEL_MODE = os.getenv("MAIL_NEXUS_BODY_MODEL_MODE", "auto").lower()
# Set only to authserv-ids inserted by trusted ingress after sender-supplied copies are removed.
TRUSTED_AUTHSERV_IDS = frozenset(
	authserv_id.strip().lower()
	for authserv_id in os.getenv("MAIL_NEXUS_TRUSTED_AUTHSERV_IDS", "").split(",")
	if authserv_id.strip()
)
YARA_RULES_DIR = Path(os.getenv("MAIL_NEXUS_YARA_RULES_DIR", BASE_DIR / "rules"))
ATTACHMENT_SCAN_DIR = Path(os.getenv("MAIL_NEXUS_ATTACHMENT_SCAN_DIR", "/tmp"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
IPINFO_TOKEN = os.getenv("IPINFO_TOKEN")
VIRUSTOTAL_URL = "https://www.virustotal.com/api/v3/files"
VIRUSTOTAL_TIMEOUT_SECONDS = float(os.getenv("MAIL_NEXUS_VIRUSTOTAL_TIMEOUT_SECONDS", "1.5"))
ZIP_MAX_ENTRIES = max(0, int(os.getenv("MAIL_NEXUS_ZIP_MAX_ENTRIES", "100")))
ZIP_MAX_MEMBER_BYTES = max(0, int(os.getenv("MAIL_NEXUS_ZIP_MAX_MEMBER_BYTES", str(10 * 1024 * 1024))))
ZIP_MAX_TOTAL_BYTES = max(0, int(os.getenv("MAIL_NEXUS_ZIP_MAX_TOTAL_BYTES", str(50 * 1024 * 1024))))
ZIP_MAX_COMPRESSION_RATIO = max(0.0, float(os.getenv("MAIL_NEXUS_ZIP_MAX_COMPRESSION_RATIO", "100")))
ZIP_MAX_NESTED_DEPTH = max(0, int(os.getenv("MAIL_NEXUS_ZIP_MAX_NESTED_DEPTH", "2")))
LAYER_TIMEOUT_SECONDS = float(os.getenv("MAIL_NEXUS_LAYER_TIMEOUT_SECONDS", "0.20"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
LLM_TIMEOUT_SECONDS = float(os.getenv("MAIL_NEXUS_LLM_TIMEOUT_SECONDS", "25"))
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")
DATABASE_URL = os.getenv("MAIL_NEXUS_DATABASE_URL", f"sqlite:///{BASE_DIR / 'mail_nexus.db'}")
IP_INTELLIGENCE_PATH = Path(os.getenv("MAIL_NEXUS_IP_INTELLIGENCE_PATH", BASE_DIR / "data" / "ip_intelligence.csv"))
GEOLOCATION_URL = os.getenv("MAIL_NEXUS_GEOLOCATION_URL", "https://ipwho.is")
IPINFO_TOKEN = os.getenv("IPINFO_TOKEN")
GEOLOCATION_TIMEOUT_SECONDS = float(os.getenv("MAIL_NEXUS_GEOLOCATION_TIMEOUT_SECONDS", "1.5"))
TRUSTED_RECEIVED_HOSTS = {
	host.strip().lower().rstrip(".")
	for host in os.getenv("MAIL_NEXUS_TRUSTED_RECEIVED_HOSTS", "").split(",")
	if host.strip()
}
COLLEGE_DOMAINS = {
	domain.strip().lower()
	for domain in os.getenv("MAIL_NEXUS_COLLEGE_DOMAINS", "college-example.edu.in,cgc.edu.in,edushield1.in,edushiel1.in").split(",")
	if domain.strip()
}
CORS_ORIGINS = [
	origin.strip()
	for origin in os.getenv(
		"MAIL_NEXUS_CORS_ORIGINS",
		"https://mail.edushield1.in,https://organization-a.edushield1.in,https://organization-b.edushield1.in,https://soc.edushield1.in,http://localhost:3000,http://localhost:3001",
	).split(",")
	if origin.strip()
]
