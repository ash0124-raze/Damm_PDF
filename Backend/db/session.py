from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import settings

# Create the SQLAlchemy Engine
# It reads the DATABASE_URL from your .env file via core/config.py
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Automatically tests connections before using them
    pool_size=10,        # Maximum number of connections to keep open
    max_overflow=20      # Extra connections allowed during traffic spikes
)

# SessionLocal is the factory that generates database sessions for each request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class for all your database models
Base = declarative_base()

# Dependency block: We will use this in FastAPI to safely open/close connections
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()