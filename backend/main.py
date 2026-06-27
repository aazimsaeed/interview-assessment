from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
import os
import uuid
import hashlib
import random  # <-- Added for secure random OTP generation
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
    advertisements_collection,
    applications_collection, 
    hidden_sessions_collection
)

# Load environment variables
load_dotenv(override=True)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Application Lifespan (Startup / Shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print("⏳ Attempting to connect to MongoDB...")
        await client.server_info()
        print("✅ Successfully connected to MongoDB!")
        await init_db_indexes()
        yield 
    except Exception as e:
        print(f"\n❌ APPLICATION STARTUP FAILED: MongoDB Connection Error.")
        print(f"Details: {e}\n")
        raise e
    finally:
        client.close()

app = FastAPI(lifespan=lifespan)

# --- CORS Configuration ---
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
    recruiter_key: str 

class AnswerPayload(BaseModel):
    interview_id: str
    question: str
    user_answer: str

class UserAuth(BaseModel):
    username: str
    password: str

class UpdateOTPRequest(BaseModel):
    email: str
    role: str
    username: str

class RecruiterRegister(BaseModel):
    username: str
    password: str
    email: str
    company_name: str
    otp: str

class RecruiterProfileUpdate(BaseModel):
    email: str
    company_name: str

class ForgotPasswordRequest(BaseModel):
    role: str
    email: str

class RegisterOTPRequest(BaseModel):
    email: str
    role: str

class PasswordReset(BaseModel):
    role: str
    email: str
    otp: str
    new_password: str
# New schema for tracking Admin Email and verification states
class AdminAuth(BaseModel):
    email: str
    otp: Optional[str] = None

class ProfileUpdate(BaseModel):
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    otp: Optional[str] = None

class CandidateRegister(BaseModel):
    username: str
    password: str
    email: str
    phone: str  
    otp: str

class RoleUpdate(BaseModel):
    username: str
    role: str

class LinkPayload(BaseModel):
    username: str
    recruiter_key: str

class PolishRequest(BaseModel):
    raw_text: str

class ReportPayload(BaseModel):
    interview_id: str
    candidate_name: str
    duration: int
    metrics: dict
    report: dict

class AdCreate(BaseModel):
    recruiter_key: str
    company_name: str
    job_title: str
    description: str
    schedule: str = "Full-time"
    location: str = "Remote"

class ApplicationCreate(BaseModel):
    candidate_username: str
    ad_id: str
    recruiter_key: str

def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

# ==========================================
# AUTHENTICATION & KEY ENDPOINTS
# ==========================================

# --- NEW: AUTHORIZED ADMIN SYSTEM CONFIG ---
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
admin_otp_store = {}
reset_otp_store = {}
register_otp_store = {}

@app.post("/api/admins/verify-email")
async def verify_admin_email(payload: AdminAuth):
    if payload.email.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(
            status_code=400, 
            detail="Email address not authorized, please enter the valid email"
        )
    return {"message": "Authorization done successfully"}

@app.post("/api/admins/request-otp")
async def request_admin_otp(payload: AdminAuth):
    if payload.email.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(
            status_code=400, 
            detail="Email address not authorized, please enter the valid email"
        )
    
    otp = str(random.randint(100000, 999999))
    admin_otp_store[payload.email.lower()] = otp
    return {"generated_otp": otp}

@app.post("/api/admins/login")
async def login_admin(payload: AdminAuth):
    email_key = payload.email.lower()
    if email_key != ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if email_key not in admin_otp_store or admin_otp_store[email_key] != payload.otp:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    
    del admin_otp_store[email_key]
    return {"username": "SuperAdmin", "role": "admin"}

@app.get("/api/admins/system-stats")
async def get_system_stats():
    r_count = await recruiters_collection.count_documents({})
    c_count = await candidates_collection.count_documents({})
    i_count = await interviews_collection.count_documents({})
    rep_count = await reports_collection.count_documents({})
    return {
        "recruiters": r_count,
        "candidates": c_count,
        "interviews": i_count,
        "reports": rep_count
    }

@app.get("/api/admins/users")
async def get_all_users_for_admin():
    recruiters = await recruiters_collection.find({}, {"_id": 0, "password_hash": 0}).to_list(length=1000)
    candidates = await candidates_collection.find({}, {"_id": 0, "password_hash": 0}).to_list(length=1000)
    return {"recruiters": recruiters, "candidates": candidates}

@app.delete("/api/admins/users/{role}/{username}")
async def admin_delete_user(role: str, username: str):
    if role == "recruiter":
        db_recruiter = await recruiters_collection.find_one({"username": username})
        if not db_recruiter:
            raise HTTPException(status_code=404, detail="Recruiter not found")
            
        rec_key = db_recruiter.get("recruiter_key")
        
        if rec_key:
            # Wipe ads and interviews
            await advertisements_collection.delete_many({"recruiter_key": rec_key})
            await interviews_collection.delete_many({"recruiter_key": rec_key})
            
            # Unlink candidates entirely
            await candidates_collection.update_many(
                {"linked_recruiters.recruiter_key": rec_key},
                {"$pull": {"linked_recruiters": {"recruiter_key": rec_key}}}
            )
            await candidates_collection.update_many(
                {"linked_recruiter": rec_key},
                {"$unset": {"linked_recruiter": "", "recruiter_name": ""}}
            )
            
        await recruiters_collection.delete_one({"username": username})
        return {"message": f"Recruiter {username} deleted."}
        
    elif role == "candidate":
        # Ensure candidate cleanup is also absolute
        await applications_collection.delete_many({"candidate_username": username})
        await reports_collection.delete_many({"candidate_name": username})
        await interviews_collection.delete_many({"candidate_name": username})
        await candidates_collection.delete_one({"username": username})
        return {"message": f"Candidate {username} deleted."}
        
    raise HTTPException(status_code=400, detail="Invalid role")

@app.get("/api/admins/all-interviews")
async def get_all_global_interviews():
    interviews = await interviews_collection.find({}, {"_id": 0}).to_list(length=1000)
    result = []
    for i in interviews:
        report_exists = await reports_collection.find_one({"interview_id": i["id"]}) is not None
        result.append({
            "id": i["id"],
            "candidate_name": i.get("candidate_name", "Unknown"),
            "recruiter_key": i.get("recruiter_key", "Unknown"),
            "target_role": i["target_role"],
            "created_at": i.get("created_at", datetime.now(timezone.utc).isoformat()),
            "is_completed": report_exists
        })
    return result

# --- RECRUITER & CANDIDATE AUTH ENDPOINTS ---
@app.post("/api/recruiters/register")
async def register_recruiter(user: RecruiterRegister):
    # 1. VERIFY OTP FIRST
    key = f"recruiter_{user.email.lower()}"
    if key not in register_otp_store or register_otp_store[key] != user.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired Verification Code")
        
    existing_user = await recruiters_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    recruiter_key = str(uuid.uuid4())[:6].upper()
    await recruiters_collection.insert_one({
        "username": user.username, 
        "password_hash": hash_password(user.password),
        "email": user.email.lower(),
        "company_name": user.company_name,
        "recruiter_key": recruiter_key
    })
    
    del register_otp_store[key] # Cleanup OTP
    return {"message": "Recruiter registered successfully"}

@app.post("/api/register/request-otp")
async def request_registration_otp(payload: RegisterOTPRequest):
    email = payload.email.lower()
    
    # Check if email is already in use
    if payload.role == "recruiter":
        existing = await recruiters_collection.find_one({"email": email})
    else:
        existing = await candidates_collection.find_one({"email": email})
        
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered.")
        
    otp = str(random.randint(100000, 999999))
    register_otp_store[f"{payload.role}_{email}"] = otp
    
    # In a production app, you would use an SMTP library here to email the OTP.
    # For now, we will print it to the terminal for you to test!
    print(f"\n📧 EMAIL SENT TO: {email} | VERIFICATION CODE: {otp}\n")
    
    return {"message": "Verification code sent to email", "otp_for_testing": otp}

@app.post("/api/recruiters/login")
async def login_recruiter(user: UserAuth):
    db_user = await recruiters_collection.find_one({"username": user.username})
    if not db_user or db_user["password_hash"] != hash_password(user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Return the company_name and recruiter_key so the frontend can use them!
    return {
        "username": db_user["username"], 
        "role": "recruiter",
        "company_name": db_user.get("company_name", "Unknown Company"),
        "recruiter_key": db_user.get("recruiter_key", "")
    }

@app.get("/api/recruiters/{username}")
async def get_recruiter_details(username: str):
    recruiter = await recruiters_collection.find_one({"username": username})
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")
    
    key = recruiter.get("recruiter_key")
    if not key:
        key = str(uuid.uuid4())[:6].upper()
        await recruiters_collection.update_one({"username": username}, {"$set": {"recruiter_key": key}})
        
    return {"recruiter_key": key}

@app.delete("/api/recruiters/{username}")
async def delete_recruiter_account(username: str):
    user = await recruiters_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="Recruiter not found")
        
    rec_key = user.get("recruiter_key")
    
    if rec_key:
        # 1. Cascade Delete: Wipe all of their ads and interviews
        await advertisements_collection.delete_many({"recruiter_key": rec_key})
        await interviews_collection.delete_many({"recruiter_key": rec_key})
        
        # 2. Unlink Array: Remove this recruiter from any candidate's multiple-job array
        await candidates_collection.update_many(
            {"linked_recruiters.recruiter_key": rec_key},
            {"$pull": {"linked_recruiters": {"recruiter_key": rec_key}}}
        )
        
        # 3. Unlink Legacy: Clear out the old single-link fields just in case
        await candidates_collection.update_many(
            {"linked_recruiter": rec_key},
            {"$unset": {"linked_recruiter": "", "recruiter_name": ""}}
        )
    
    # 4. Delete the actual recruiter account
    await recruiters_collection.delete_one({"username": username})
    return {"message": "Recruiter account and all associated data deleted successfully"}

@app.post("/api/profile/request-otp")
async def request_profile_update_otp(payload: UpdateOTPRequest):
    email = payload.email.lower()
    
    # Check if the new email belongs to someone else
    if payload.role == "recruiter":
        existing = await recruiters_collection.find_one({"email": email})
    else:
        existing = await candidates_collection.find_one({"email": email})
        
    if existing and existing.get("username") != payload.username:
        raise HTTPException(status_code=400, detail="This email is already in use by another account.")
        
    otp = str(random.randint(100000, 999999))
    register_otp_store[f"update_{payload.role}_{email}"] = otp
    print(f"\n📧 PROFILE UPDATE EMAIL SENT TO: {email} | VERIFICATION CODE: {otp}\n")
    
    return {"message": "Verification code sent", "otp_for_testing": otp}

@app.put("/api/recruiters/{username}/profile")
async def update_recruiter_profile(username: str, data: ProfileUpdate):
    user = await recruiters_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_email = data.email.lower()
    if user.get("email") != new_email:
        # Email has changed, strict OTP verification required
        key = f"update_recruiter_{new_email}"
        if key not in register_otp_store or register_otp_store[key] != data.otp:
            raise HTTPException(status_code=400, detail="Invalid or expired Verification Code for the new email.")
        del register_otp_store[key] # cleanup
        
    await recruiters_collection.update_one(
        {"username": username},
        {"$set": {"email": new_email, "company_name": data.company_name}}
    )
    return {"message": "Company Profile updated successfully"}


@app.post("/api/candidates/register")
async def register_candidate(user: CandidateRegister):
    # 1. VERIFY OTP FIRST
    key = f"candidate_{user.email.lower()}"
    if key not in register_otp_store or register_otp_store[key] != user.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired Verification Code")
        
    existing_user = await candidates_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    await candidates_collection.insert_one({
        "username": user.username, 
        "password_hash": hash_password(user.password),
        "email": user.email.lower(),
        "phone": user.phone,
        "linked_recruiters": []
    })
    
    del register_otp_store[key] # Cleanup OTP
    return {"message": "Candidate registered successfully"}

@app.post("/api/candidates/login")
async def login_candidate(user: UserAuth):
    db_user = await candidates_collection.find_one({"username": user.username})
    if not db_user or db_user["password_hash"] != hash_password(user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": db_user["username"], "role": "candidate"}
@app.post("/api/forgot-password/request")
async def forgot_password_request(payload: ForgotPasswordRequest):
    collection = recruiters_collection if payload.role == "recruiter" else candidates_collection
    user = await collection.find_one({"email": payload.email.lower()})
    
    if not user:
        raise HTTPException(status_code=404, detail="Email not found in our system")
    
    otp = str(random.randint(100000, 999999))
    reset_otp_store[f"{payload.role}_{payload.email.lower()}"] = otp
    return {"generated_otp": otp, "message": "OTP generated"}

@app.post("/api/forgot-password/reset")
async def forgot_password_reset(payload: PasswordReset):
    key = f"{payload.role}_{payload.email.lower()}"
    
    if key not in reset_otp_store or reset_otp_store[key] != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    collection = recruiters_collection if payload.role == "recruiter" else candidates_collection
    await collection.update_one(
        {"email": payload.email.lower()},
        {"$set": {"password_hash": hash_password(payload.new_password)}}
    )
    
    del reset_otp_store[key] # Clean up OTP
    return {"message": "Password updated successfully"}

# ==========================================
# JOB BOARD & APPLICATION ENDPOINTS
# ==========================================

@app.post("/api/advertisements")
async def create_advertisement(ad: AdCreate):
    ad_dict = ad.dict()
    ad_dict["id"] = str(uuid.uuid4())
    ad_dict["created_at"] = datetime.utcnow().isoformat()
    await advertisements_collection.insert_one(ad_dict)
    return {"message": "Advertisement created successfully"}

@app.get("/api/advertisements")
async def get_all_advertisements():
    # Public endpoint for the landing page
    ads = await advertisements_collection.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return ads

@app.post("/api/applications")
async def apply_for_job(app: ApplicationCreate):
    app_id = str(uuid.uuid4())[:8]
    
    # 1. Check if candidate has already applied for this EXACT job
    existing = await applications_collection.find_one({
        "candidate_username": app.candidate_username, 
        "ad_id": app.ad_id
    })
    if existing:
        return {"message": "Already applied"}
        
    # 2. Add to applications collection as "pending" EVERY TIME
    await applications_collection.insert_one({
        "id": app_id,
        "candidate_username": app.candidate_username,
        "ad_id": app.ad_id,
        "recruiter_key": app.recruiter_key,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Application submitted"}

@app.get("/api/recruiters/{recruiter_key}/applications")
async def get_recruiter_applications(recruiter_key: str):
    # Get all pending applications for this recruiter
    apps = await applications_collection.find({"recruiter_key": recruiter_key, "status": "pending"}, {"_id": 0}).to_list(length=100)
    
    # Enrich with Job Title and Candidate Email
    enriched_apps = []
    for app in apps:
        ad = await advertisements_collection.find_one({"id": app["ad_id"]})
        candidate = await candidates_collection.find_one({"username": app["candidate_username"]})
        if ad and candidate:
            app["job_title"] = ad["job_title"]
            app["candidate_email"] = candidate.get("email", "N/A")
            enriched_apps.append(app)
            
    return enriched_apps

@app.post("/api/applications/{app_id}/approve")
async def approve_application(app_id: str):
    await applications_collection.update_one({"id": app_id}, {"$set": {"status": "approved"}})
    
    app_doc = await applications_collection.find_one({"id": app_id})
    recruiter = await recruiters_collection.find_one({"recruiter_key": app_doc["recruiter_key"]})
    ad = await advertisements_collection.find_one({"id": app_doc["ad_id"]}) # <-- Fetch the Ad
    
    if app_doc and recruiter and ad:
        await candidates_collection.update_one(
            {"username": app_doc["candidate_username"]},
            {"$addToSet": {
                "linked_recruiters": {
                    "recruiter_key": recruiter["recruiter_key"],
                    "company_name": recruiter["company_name"],
                    "target_role": ad["job_title"] # <-- Lock in the applied role!
                }
            }}
        )
    return {"message": "Candidate approved and linked!"}

@app.get("/api/candidates/{username}/links")
async def get_candidate_links(username: str):
    candidate = await candidates_collection.find_one({"username": username})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    # Return the array of approved recruiters
    return candidate.get("linked_recruiters", [])
@app.post("/api/candidates/role")
async def set_candidate_role(payload: RoleUpdate):
    result = await candidates_collection.update_one(
        {"username": payload.username}, 
        {"$set": {"role": payload.role}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Role saved successfully"}

@app.get("/api/candidates/{username}/link_status")
async def get_candidate_link_status(username: str):
    candidate = await candidates_collection.find_one({"username": username})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return {
        "is_linked": candidate.get("linked_recruiter") is not None,
        "recruiter_name": candidate.get("recruiter_name"),
        "recruiter_key": candidate.get("linked_recruiter") 
    }

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

@app.put("/api/candidates/{username}/profile")
async def update_candidate_profile(username: str, data: ProfileUpdate):
    user = await candidates_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_email = data.email.lower()
    if user.get("email") != new_email:
        # Email has changed, strict OTP verification required
        key = f"update_candidate_{new_email}"
        if key not in register_otp_store or register_otp_store[key] != data.otp:
            raise HTTPException(status_code=400, detail="Invalid or expired Verification Code for the new email.")
        del register_otp_store[key] # cleanup
        
    await candidates_collection.update_one(
        {"username": username},
        {"$set": {"email": new_email, "phone": data.phone}}
    )
    return {"message": "Candidate Profile updated successfully"}

# ==========================================
# GET PROFILE ENDPOINTS (Add these to fix the "N/A" issue)
# ==========================================

@app.get("/api/recruiters/{username}/profile")
async def get_recruiter_profile(username: str):
    user = await recruiters_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="Recruiter not found")
        
    return {
        "email": user.get("email", ""),
        "company_name": user.get("company_name", "")
    }

@app.get("/api/candidates/{username}/profile")
async def get_candidate_profile(username: str):
    user = await candidates_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    return {
        "email": user.get("email", ""),
        "phone": user.get("phone", "")
    }

@app.get("/api/candidates")
async def get_all_candidates(recruiter_key: str = None):
    if not recruiter_key: return [] 
        
    cursor = candidates_collection.find({"linked_recruiters.recruiter_key": recruiter_key}, {"_id": 0})
    users = await cursor.to_list(length=1000)
    
    result = []
    for u in users:
        # A candidate might be linked to the same recruiter for MULTIPLE roles!
        # We loop through all links and append a result for EVERY match.
        for link in u.get("linked_recruiters", []):
            if link.get("recruiter_key") == recruiter_key:
                result.append({
                    "username": u["username"], 
                    "email": u.get("email", ""), 
                    "target_role": link.get("target_role", "Unknown Role")
                })
                
    return result

# ==========================================
# FETCH & DELETE INTERVIEW ENDPOINTS
# ==========================================
@app.get("/api/candidates/{username}/interviews")
async def get_candidate_interviews(username: str, role: str = "candidate", recruiter_key: str = None):
    query = {"candidate_name": username}
    if recruiter_key:
        query["recruiter_key"] = recruiter_key

    interviews = await interviews_collection.find(query, {"_id": 0}).to_list(length=1000)
    hidden_records = await hidden_sessions_collection.find({"role": role}, {"_id": 0}).to_list(length=1000)
    hidden_ids = {record["interview_id"] for record in hidden_records}
    
    result = []
    for i in interviews:
        if i["id"] in hidden_ids:
            continue
        report_exists = await reports_collection.find_one({"interview_id": i["id"]}) is not None
        result.append({
            "id": i["id"], 
            "target_role": i["target_role"],
            "created_at": i.get("created_at", datetime.now(timezone.utc).isoformat()),
            "is_completed": report_exists,
            "recruiter_key": i.get("recruiter_key", "") # <-- This ensures the frontend doesn't crash!
        })
    return result

@app.get("/api/recruiters/{recruiter_key}/all-interviews")
async def get_all_recruiter_interviews(recruiter_key: str):
    interviews = await interviews_collection.find({"recruiter_key": recruiter_key}, {"_id": 0}).to_list(length=1000)
    hidden_records = await hidden_sessions_collection.find({"role": "recruiter"}, {"_id": 0}).to_list(length=1000)
    hidden_ids = {record["interview_id"] for record in hidden_records}
    
    result = []
    for i in interviews:
        if i["id"] in hidden_ids:
            continue
        report_exists = await reports_collection.find_one({"interview_id": i["id"]}) is not None
        result.append({
            "id": i["id"], 
            "candidate_name": i.get("candidate_name", "Unknown"), 
            "target_role": i["target_role"],
            "created_at": i.get("created_at", datetime.now(timezone.utc).isoformat()),
            "is_completed": report_exists
        })
    return result

@app.delete("/api/interviews/{interview_id}")
async def delete_interview(interview_id: str, role: str = "candidate"):
    if role == "admin":
        await reports_collection.delete_one({"interview_id": interview_id})
        await hidden_sessions_collection.delete_many({"interview_id": interview_id})
        await interviews_collection.delete_one({"id": interview_id})
        return {"message": "Interview session permanently deleted."}
    
    existing_hidden = await hidden_sessions_collection.find_one({
        "interview_id": interview_id,
        "role": role
    })
    if not existing_hidden:
        await hidden_sessions_collection.insert_one({"interview_id": interview_id, "role": role})
    return {"message": f"Interview session hidden for {role} successfully"}

@app.delete("/api/candidates/{username}")
async def delete_candidate_account(username: str):
    # 1. Cascade Delete: Wipe all of their applications, interviews, and reports
    await applications_collection.delete_many({"candidate_username": username})
    await interviews_collection.delete_many({"candidate_name": username})
    await reports_collection.delete_many({"candidate_name": username})
    
    # 2. Delete the actual candidate account
    await candidates_collection.delete_one({"username": username})
    return {"message": "Candidate account and all associated data deleted successfully"}

# ==========================================
# NEW ENDPOINTS FOR DELETING ADS & UNLINKING
# ==========================================

@app.delete("/api/advertisements/{ad_id}")
async def delete_advertisement(ad_id: str):
    # 1. Delete the actual advertisement
    delete_result = await advertisements_collection.delete_one({"id": ad_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Advertisement not found")
        
    # 2. Cascade Delete: Remove any pending applications tied to this deleted job
    await applications_collection.delete_many({"ad_id": ad_id})
    
    return {"message": "Advertisement and associated applications deleted successfully"}

@app.post("/api/candidates/{username}/unlink")
async def unlink_candidate(username: str, payload: dict):
    recruiter_key = payload.get("recruiter_key")
    target_role = payload.get("target_role")
    
    if not recruiter_key or not target_role:
        raise HTTPException(status_code=400, detail="Missing recruiter_key or target_role")
        
    # Pull (remove) ONLY the specific job role for this recruiter
    await candidates_collection.update_one(
        {"username": username},
        {"$pull": {"linked_recruiters": {"recruiter_key": recruiter_key, "target_role": target_role}}}
    )
    return {"message": "Candidate role successfully unlinked"}
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
    
    You MUST return your response as a valid JSON object with exact keys "score" (a number), "feedback" (a very very short string), and "idealAnswer" (a string).
    
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
        "recruiter_key": setup.recruiter_key, 
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
    await reports_collection.insert_one(payload.dict())
    return {"message": "Report saved successfully"}

@app.get("/api/reports/{interview_id}")
async def get_interview_report(interview_id: str):
    db_report = await reports_collection.find_one({"interview_id": interview_id}, {"_id": 0})
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found or interview incomplete.")
    return db_report
@app.delete("/api/reports/{interview_id}")
async def delete_interview_report(interview_id: str):
    # This specifically deletes the report, reverting the session to "Pending"
    result = await reports_collection.delete_one({"interview_id": interview_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report permanently deleted."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)