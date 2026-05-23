from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
import os
import uuid
import hashlib
from datetime import datetime, timezone
from dotenv import load_dotenv

# --- IMPORT MONGODB COLLECTIONS ---
from database import (
    client, 
    init_db_indexes,
    recruiters_collection, 
    candidates_collection, 
    interviews_collection, 
    reports_collection, 
    hidden_sessions_collection
)

# Load environment variables
load_dotenv(override=True)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Application Lifespan (Startup / Shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Force a quick connection test on startup
        print("⏳ Attempting to connect to MongoDB...")
        await client.server_info()
        print("✅ Successfully connected to MongoDB!")
        
        # Initialize DB indexes
        await init_db_indexes()
        
        yield 
        
    except Exception as e:
        print(f"\n❌ APPLICATION STARTUP FAILED: MongoDB Connection Error.")
        print(f"Details: {e}\n")
        print("👉 FIX: Ensure MONGO_URL environment variable is correct.")
        print("👉 FIX: If using MongoDB Atlas, check that your deployment's IP is whitelisted.\n")
        raise e
    finally:
        # Close connection on shutdown
        client.close()

app = FastAPI(lifespan=lifespan)

# --- CORS Configuration for Deployment ---
FRONTEND_URL = os.getenv("FRONTEND_URL", "*") 

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI MODEL INITIALIZATION
model = genai.GenerativeModel('gemini-2.5-flash')

# ==========================================
# PYDANTIC SCHEMAS
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

# Schema for linking candidates to recruiters
class LinkPayload(BaseModel):
    username: str
    recruiter_key: str

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
    snapshots: list = [] 

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
# AUTHENTICATION & KEY ENDPOINTS
# ==========================================

@app.post("/api/recruiters/register")
async def register_recruiter(user: UserAuth):
    existing_user = await recruiters_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Generate a random 6-character uppercase key
    recruiter_key = str(uuid.uuid4())[:6].upper()
    
    await recruiters_collection.insert_one({
        "username": user.username, 
        "password_hash": hash_password(user.password),
        "recruiter_key": recruiter_key
    })
    return {"message": "Recruiter registered successfully"}

@app.post("/api/recruiters/login")
async def login_recruiter(user: UserAuth):
    db_user = await recruiters_collection.find_one({"username": user.username})
    if not db_user or db_user["password_hash"] != hash_password(user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": db_user["username"], "role": "recruiter"}

# Fetch Recruiter Key securely for the Dashboard
@app.get("/api/recruiters/{username}")
async def get_recruiter_details(username: str):
    recruiter = await recruiters_collection.find_one({"username": username})
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")
    
    # Fallback to generate key for older accounts created before this update
    key = recruiter.get("recruiter_key")
    if not key:
        key = str(uuid.uuid4())[:6].upper()
        await recruiters_collection.update_one({"username": username}, {"$set": {"recruiter_key": key}})
        
    return {"recruiter_key": key}

@app.post("/api/candidates/register")
async def register_candidate(user: CandidateRegister):
    existing_user = await candidates_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    await candidates_collection.insert_one({
        "username": user.username, 
        "password_hash": hash_password(user.password),
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "linked_recruiter": None,
        "recruiter_name": None
    })
    return {"message": "Candidate registered successfully"}

@app.post("/api/candidates/login")
async def login_candidate(user: UserAuth):
    db_user = await candidates_collection.find_one({"username": user.username})
    if not db_user or db_user["password_hash"] != hash_password(user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": db_user["username"], "role": "candidate"}

@app.post("/api/candidates/role")
async def set_candidate_role(payload: RoleUpdate):
    result = await candidates_collection.update_one(
        {"username": payload.username}, 
        {"$set": {"role": payload.role}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Role saved successfully"}

# Fetch Candidate Link Status for Setup Portal
@app.get("/api/candidates/{username}/link_status")
async def get_candidate_link_status(username: str):
    candidate = await candidates_collection.find_one({"username": username})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return {
        "is_linked": candidate.get("linked_recruiter") is not None,
        "recruiter_name": candidate.get("recruiter_name")
    }

# Endpoint to link candidate via Recruiter Key
@app.post("/api/candidates/link")
async def link_candidate_to_recruiter(payload: LinkPayload):
    recruiter = await recruiters_collection.find_one({"recruiter_key": payload.recruiter_key})
    if not recruiter:
        raise HTTPException(status_code=404, detail="Invalid Recruiter Key.")
        
    await candidates_collection.update_one(
        {"username": payload.username},
        {"$set": {
            "linked_recruiter": payload.recruiter_key,
            "recruiter_name": recruiter["username"]
        }}
    )
    return {"recruiter_name": recruiter["username"]}

# Only return candidates linked to a specific key
@app.get("/api/candidates")
async def get_all_candidates(recruiter_key: str = None):
    if not recruiter_key:
        return [] # Do not expose candidates if no key is provided
        
    cursor = candidates_collection.find({"linked_recruiter": recruiter_key}, {"_id": 0})
    users = await cursor.to_list(length=1000)
    return [
        {
            "username": u["username"], 
            "email": u.get("email", ""), 
            "phone": u.get("phone", ""), 
            "role": u.get("role", "Not Selected")
        } for u in users
    ]

# ==========================================
# FETCH & DELETE INTERVIEW ENDPOINTS
# ==========================================

@app.get("/api/candidates/{username}/interviews")
async def get_candidate_interviews(username: str, role: str = "candidate"):
    # Find all interviews for candidate
    interviews = await interviews_collection.find({"candidate_name": username}, {"_id": 0}).to_list(length=1000)
    
    # Grab the IDs that this specific role has chosen to hide
    hidden_records = await hidden_sessions_collection.find({"role": role}, {"_id": 0}).to_list(length=1000)
    hidden_ids = {record["interview_id"] for record in hidden_records}
    
    result = []
    for i in interviews:
        # If this role hid this session, skip it
        if i["id"] in hidden_ids:
            continue
            
        report_exists = await reports_collection.find_one({"interview_id": i["id"]}) is not None
        
        result.append({
            "id": i["id"], 
            "target_role": i["target_role"],
            "created_at": i.get("created_at", datetime.now(timezone.utc).isoformat()),
            "is_completed": report_exists
        })
    return result

@app.delete("/api/interviews/{interview_id}")
async def delete_interview(interview_id: str, role: str = "candidate"):
    # Simply log that this role wants this interview ID hidden from them
    existing_hidden = await hidden_sessions_collection.find_one({
        "interview_id": interview_id,
        "role": role
    })
    
    if not existing_hidden:
        await hidden_sessions_collection.insert_one({"interview_id": interview_id, "role": role})
        
    return {"message": f"Interview session hidden for {role} successfully"}

@app.delete("/api/candidates/{username}")
async def delete_candidate(username: str):
    db_candidate = await candidates_collection.find_one({"username": username})
    if not db_candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Hard Delete everything for the candidate if requested by Recruiter
    await reports_collection.delete_many({"candidate_name": username})
    await interviews_collection.delete_many({"candidate_name": username})
    await candidates_collection.delete_one({"username": username})
    
    return {"message": "Candidate and all associated data deleted successfully"}

# ==========================================
# GEMINI GENERATION & EVALUATION
# ==========================================

@app.get("/api/generate-questions")
async def generate_questions(role: str):
    prompt = f'You are an expert interviewer. Generate exactly 5 common behavioral and technical interview questions for a candidate applying for a "{role}" role. Return ONLY the questions, one per line. Do NOT include numbers, bullet points, markdown, or introductory text.'
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

@app.post("/api/evaluate")
async def evaluate_candidate_answer(payload: AnswerPayload):
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
    
    You MUST return your response as a valid JSON object with exact keys "score" (a number), "feedback" (a short string), and "idealAnswer" (a string).
    
    CRITICAL INSTRUCTION: You MUST ALWAYS provide the "idealAnswer" field. It should contain a highly effective, alternative way to answer the question to serve as a helpful example for the candidate. Do not include markdown code blocks.
    """
    
    try:
        response = model.generate_content(prompt)
        text_result = response.text.replace('```json', '').replace('```', '').strip()
        import json
        parsed_data = json.loads(text_result)
        
        return {
            "score": parsed_data.get("score", 0),
            "feedback": parsed_data.get("feedback", "Unable to parse feedback."),
            "idealAnswer": parsed_data.get("ideal_answer", parsed_data.get("idealAnswer", "No ideal answer provided."))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# INTERVIEW & REPORT CREATION
# ==========================================

@app.post("/api/interviews")
async def create_interview(setup: InterviewSetup):
    interview_id = str(uuid.uuid4())[:8]  
    
    await interviews_collection.insert_one({
        "id": interview_id,
        "candidate_name": setup.candidate_name,
        "target_role": setup.target_role,
        "questions": setup.questions,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"interview_id": interview_id}

@app.get("/api/interviews/{interview_id}")
async def get_interview(interview_id: str):
    db_session = await interviews_collection.find_one({"id": interview_id}, {"_id": 0})
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    
    return {
        "candidate_name": db_session["candidate_name"],
        "target_role": db_session["target_role"],
        "questions": db_session["questions"]
    }

@app.post("/api/reports")
async def save_interview_report(payload: ReportPayload):
    existing_report = await reports_collection.find_one({"interview_id": payload.interview_id})
    if existing_report:
        raise HTTPException(status_code=400, detail="Report already exists for this interview.")
    
    # Store directly as a dictionary! No JSON stringification needed in MongoDB.
    await reports_collection.insert_one(payload.dict())
    
    return {"message": "Report saved successfully"}

@app.get("/api/reports/{interview_id}")
async def get_interview_report(interview_id: str):
    # Retrieve the report, specifically ignoring the MongoDB unique `_id` field
    db_report = await reports_collection.find_one({"interview_id": interview_id}, {"_id": 0})
    
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found or interview incomplete.")
        
    return db_report

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)