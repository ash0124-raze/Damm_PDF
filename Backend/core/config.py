from pydantic_settings import BaseSettings,SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Damm PDF"
    API_V1_STR: str = "/api/v1"
    debug: bool = True
    DATABASE_URL: str
    # Queue Configuration (Upstash Redis)
    REDIS_URL: str
    
    # Cloud Storage (Cloudflare R2 / S3)
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    S3_BUCKET_NAME: str
    S3_ENDPOINT_URL: str
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()