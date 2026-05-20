from sqlalchemy import create_engine, Column, String, Integer, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.sql import func

# Create the SQLite engine
engine = create_engine("sqlite:///./interview_app.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- EXISTING TABLE WITH NEW TIMESTAMP ---
class InterviewSessionDB(Base):
    __tablename__ = "interviews"
    id = Column(String, primary_key=True, index=True)
    candidate_name = Column(String)
    target_role = Column(String)
    questions_json = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) # <-- NEW COLUMN

# --- NEW TABLES FOR AUTHENTICATION ---
class RecruiterDB(Base):
    __tablename__ = "recruiters"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

class CandidateDB(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    # NEW FIELDS
    email = Column(String)
    phone = Column(String)
    role = Column(String, nullable=True)


class ReportDB(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(String, unique=True, index=True)
    candidate_name = Column(String)
    duration = Column(Integer)
    metrics_json = Column(String)
    details_json = Column(String)