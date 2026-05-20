from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
import google.generativeai as genai
import os
import json
import uuid
import hashlib
from dotenv import load_dotenv

# --- IMPORT FROM DATABASE FILE ---
from database import engine, SessionLocal, Base, InterviewSessionDB, RecruiterDB, CandidateDB, ReportDB

# Load environment variables
load_dotenv(override=True)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI MODEL INITIALIZATION
model = genai.GenerativeModel('gemini-2.5-flash')

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# PYDANTIC SCHEMAS (Data Validation)
# ==========================================
class InterviewSetup(BaseModel):
    candidate_name: str
    target_role: str
    questions: List[str]

class AnswerPayload(BaseModel):
    interview_id: str
    question: str
    user_answer: str

class UserAuth(BaseModel):
    username: str
    password: str

class CandidateRegister(BaseModel):
    username: str
    password: str
    email: str
    phone: str
    role: str   

class RoleUpdate(BaseModel):
    username: str
    role: str

class PolishRequest(BaseModel):
    raw_text: str

class ReportMetrics(BaseModel):
    confidenceScore: int
    eyeContactPercentage: int
    facialExpressionFrequency: dict
    headMovementIntensity: int
    speech: dict

class ReportDetails(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]
    timeline: list = []
    snapshots: list = []  # <--- Added snapshots field to bypass Pydantic validation rejection

class ReportPayload(BaseModel):
    interview_id: str
    candidate_name: str
    duration: int
    metrics: ReportMetrics
    report: ReportDetails

# PASSWORD HASHING HELPER
def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/recruiters/register")
async def register_recruiter(user: UserAuth, db: Session = Depends(get_db)):
    if db.query(RecruiterDB).filter(RecruiterDB.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = RecruiterDB(username=user.username, password_hash=hash_password(user.password))
    db.add(new_user)
    db.commit()
    return {"message": "Recruiter registered successfully"}

@app.post("/api/recruiters/login")
async def login_recruiter(user: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(RecruiterDB).filter(RecruiterDB.username == user.username).first()
    if not db_user or db_user.password_hash != hash_password(user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": db_user.username, "role": "recruiter"}

@app.post("/api/candidates/register")
async def register_candidate(user: CandidateRegister, db: Session = Depends(get_db)):
    if db.query(CandidateDB).filter(CandidateDB.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = CandidateDB(
        username=user.username, 
        password_hash=hash_password(user.password),
        email=user.email,
        phone=user.phone,
        role=user.role 
    )
    db.add(new_user)
    db.commit()
    return {"message": "Candidate registered successfully"}

@app.post("/api/candidates/login")
async def login_candidate(user: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(CandidateDB).filter(CandidateDB.username == user.username).first()
    if not db_user or db_user.password_hash != hash_password(user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": db_user.username, "role": "candidate"}

@app.post("/api/candidates/role")
async def set_candidate_role(payload: RoleUpdate, db: Session = Depends(get_db)):
    db_user = db.query(CandidateDB).filter(CandidateDB.username == payload.username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db_user.role = payload.role
    db.commit()
    return {"message": "Role saved successfully"}

@app.get("/api/candidates")
async def get_all_candidates(db: Session = Depends(get_db)):
    users = db.query(CandidateDB).all()
    return [{"username": u.username, "email": u.email, "phone": u.phone, "role": u.role or "Not Selected"} for u in users]

# --- FETCH INTERVIEWS (UPDATED TO INCLUDE TIMESTAMP) ---
@app.get("/api/candidates/{username}/interviews")
async def get_candidate_interviews(username: str, db: Session = Depends(get_db)):
    interviews = db.query(InterviewSessionDB).filter(InterviewSessionDB.candidate_name == username).all()
    
    result = []
    for i in interviews:
        report_exists = db.query(ReportDB).filter(ReportDB.interview_id == i.id).first() is not None
        
        result.append({
            "id": i.id, 
            "target_role": i.target_role,
            "created_at": i.created_at.isoformat() if getattr(i, 'created_at', None) else "Unknown",
            "is_completed": report_exists
        })
    return result

# ==========================================
# CORE APP ENDPOINTS
# ==========================================

@app.get("/api/generate-questions")
async def generate_questions(role: str):
    prompt = f'You are an expert interviewer. Generate exactly 10 common behavioral and technical interview questions for a candidate applying for a "{role}" role. Return ONLY the questions, one per line. Do NOT include numbers, bullet points, markdown, or introductory text.'
    try:
        response = model.generate_content(prompt)
        questions = [q.strip() for q in response.text.strip().split('\n') if q.strip()]
        return {"questions": "\n".join(questions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/polish-questions")
async def polish_questions(payload: PolishRequest):
    if not payload.raw_text.strip():
        return {"questions": ""}
    
    prompt = f"""
    You are an expert technical recruiter. Review the following raw dictated interview questions.
    1. Generate only questions not other than that
    2. Fix any grammatical errors and remove filler words (like "um", "uh").
    3. Improve the wording to sound professional and clear. 
    4. Do not show the number, instead start the new question in new line.
    don't generate the heading
    
    CRITICAL: Do NOT answer the questions, just format and improve the questions themselves.
    
    Raw questions:
    {payload.raw_text}
    """
    try:
        response = model.generate_content(prompt)
        return {"questions": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interviews")
async def create_interview(setup: InterviewSetup, db: Session = Depends(get_db)):
    interview_id = str(uuid.uuid4())[:8]  
    
    new_session = InterviewSessionDB(
        id=interview_id,
        candidate_name=setup.candidate_name,
        target_role=setup.target_role,
        questions_json=json.dumps(setup.questions) 
    )
    
    db.add(new_session)
    db.commit()
    
    return {"interview_id": interview_id}

@app.get("/api/interviews/{interview_id}")
async def get_interview(interview_id: str, db: Session = Depends(get_db)):
    db_session = db.query(InterviewSessionDB).filter(InterviewSessionDB.id == interview_id).first()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    
    return {
        "candidate_name": db_session.candidate_name,
        "target_role": db_session.target_role,
        "questions": json.loads(db_session.questions_json) 
    }

@app.post("/api/evaluate")
async def evaluate_candidate_answer(payload: AnswerPayload, db: Session = Depends(get_db)):
    if len(payload.user_answer.strip()) < 10:
        return {
            "score": 0, 
            "feedback": "Answer was too short to evaluate. Please speak clearly and provide more detail.", 
            "idealAnswer": ""
        }
        
    prompt = f"""
    You are an expert technical and behavioral interviewer. 
    You asked the candidate this question: "{payload.question}"
    The candidate provided this spoken answer: "{payload.user_answer}"
    
    Evaluate the candidate's spoken answer out of 100 based on its relevance, clarity, completeness, and professionalism. 
    Do NOT strictly compare it to a single "ideal" answer. Instead, assess the merit, logical flow, and quality of the candidate's own unique response.
    
    You MUST return your response as a valid JSON object with exact keys "score" (a number), "feedback" (a very short string), and "idealAnswer" (a string).
    
    CRITICAL INSTRUCTION: You MUST ALWAYS provide the "idealAnswer" field. It should contain a highly effective, alternative way to answer the question to serve as a helpful example for the candidate. Do not include markdown code blocks.
    """
    
    try:
        response = model.generate_content(prompt)
        text_result = response.text.replace('```json', '').replace('```', '').strip()
        parsed_data = json.loads(text_result)
        
        return {
            "score": parsed_data.get("score", 0),
            "feedback": parsed_data.get("feedback", "Unable to parse feedback."),
            "idealAnswer": parsed_data.get("ideal_answer", parsed_data.get("idealAnswer", "No ideal answer provided."))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reports")
async def save_interview_report(payload: ReportPayload, db: Session = Depends(get_db)):
    existing_report = db.query(ReportDB).filter(ReportDB.interview_id == payload.interview_id).first()
    if existing_report:
        raise HTTPException(status_code=400, detail="Report already exists for this interview.")
    
    new_report = ReportDB(
        interview_id=payload.interview_id,
        candidate_name=payload.candidate_name,
        duration=payload.duration,
        metrics_json=json.dumps(payload.metrics.dict()),
        details_json=json.dumps(payload.report.dict())
    )
    db.add(new_report)
    db.commit()
    return {"message": "Report saved successfully"}

@app.get("/api/reports/{interview_id}")
async def get_interview_report(interview_id: str, db: Session = Depends(get_db)):
    db_report = db.query(ReportDB).filter(ReportDB.interview_id == interview_id).first()
    
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found or interview incomplete.")
        
    return {
        "interview_id": db_report.interview_id,
        "candidate_name": db_report.candidate_name, 
        "duration": db_report.duration,
        "metrics": json.loads(db_report.metrics_json),
        "report": json.loads(db_report.details_json)
    }
# ==========================================
# DELETION ENDPOINTS
# ==========================================

@app.delete("/api/candidates/{username}")
async def delete_candidate(username: str, db: Session = Depends(get_db)):
    db_candidate = db.query(CandidateDB).filter(CandidateDB.username == username).first()
    if not db_candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Safely cascade deletion for related reports and interviews
    db.query(ReportDB).filter(ReportDB.candidate_name == username).delete()
    db.query(InterviewSessionDB).filter(InterviewSessionDB.candidate_name == username).delete()
    
    db.delete(db_candidate)
    db.commit()
    return {"message": "Candidate and all associated data deleted successfully"}

@app.delete("/api/interviews/{interview_id}")
async def delete_interview(interview_id: str, db: Session = Depends(get_db)):
    # Delete report first to avoid orphaned data
    db.query(ReportDB).filter(ReportDB.interview_id == interview_id).delete()
    
    db_interview = db.query(InterviewSessionDB).filter(InterviewSessionDB.id == interview_id).first()
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    db.delete(db_interview)
    db.commit()
    return {"message": "Interview and its report deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)