from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "ISEEYOU OSINT Worker Engine"
    VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # Server Binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Redis / Task Queue
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # API Tokens (Optional)
    GITHUB_TOKEN: str = ""
    ABUSEIPDB_API_KEY: str = ""
    BRAVE_SEARCH_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    
    # Egress Timeout (seconds)
    HTTP_TIMEOUT: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
