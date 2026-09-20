from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.getenv("MAIL_NEXUS_MODEL_PATH", BASE_DIR / "models" / "body_model.joblib"))
YARA_RULES_DIR = Path(os.getenv("MAIL_NEXUS_YARA_RULES_DIR", BASE_DIR / "rules"))
ATTACHMENT_SCAN_DIR = Path(os.getenv("MAIL_NEXUS_ATTACHMENT_SCAN_DIR", "/tmp"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
VIRUSTOTAL_URL = "https://www.virustotal.com/api/v3/files"
LAYER_TIMEOUT_SECONDS = float(os.getenv("MAIL_NEXUS_LAYER_TIMEOUT_SECONDS", "0.20"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
LLM_TIMEOUT_SECONDS = float(os.getenv("MAIL_NEXUS_LLM_TIMEOUT_SECONDS", "15"))
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")
DATABASE_URL = os.getenv("MAIL_NEXUS_DATABASE_URL", f"sqlite:///{BASE_DIR / 'mail_nexus.db'}")
IP_INTELLIGENCE_PATH = Path(os.getenv("MAIL_NEXUS_IP_INTELLIGENCE_PATH", BASE_DIR / "data" / "ip_intelligence.csv"))
GEOLOCATION_URL = os.getenv("MAIL_NEXUS_GEOLOCATION_URL", "https://ipwho.is")
