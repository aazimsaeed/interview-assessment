import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables. In a deployed environment, these are usually set in the hosting provider's dashboard.
load_dotenv(override=True)

# Use the MONGO_URL from the environment. Fail safely if it's not provided in production.
MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    print("❌ ERROR: MONGO_URL environment variable is not set.", file=sys.stderr)
    print("👉 FIX: If running locally, add MONGO_URL=\"mongodb://localhost:27017\" to your .env file.", file=sys.stderr)
    print("👉 FIX: If deploying, ensure MONGO_URL is set in your deployment environment variables.", file=sys.stderr)
    # Don't exit immediately during a build phase, but the connection will fail if the app tries to start.
    MONGO_URL = "mongodb://localhost:27017" # Fallback for local dev if forgotten

# Create Async MongoDB Client
try:
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
except Exception as e:
     print(f"❌ ERROR: Failed to initialize MongoDB client: {e}", file=sys.stderr)
     sys.exit(1)

# Select the Database
db = client.interview_system_db

# Define Collections (analogous to SQL tables)
recruiters_collection = db.get_collection("recruiters")
candidates_collection = db.get_collection("candidates")
interviews_collection = db.get_collection("interviews")
reports_collection = db.get_collection("reports")
hidden_sessions_collection = db.get_collection("hidden_sessions")
admins_collection = db.get_collection("admins") # <-- ADDED ADMIN COLLECTION

# Create unique indexes for robust data integrity
async def init_db_indexes():
    try:
        await recruiters_collection.create_index("username", unique=True)
        await candidates_collection.create_index("username", unique=True)
        await admins_collection.create_index("username", unique=True) # <-- ADDED ADMIN INDEX
        await interviews_collection.create_index("id", unique=True)
        await reports_collection.create_index("interview_id", unique=True)
        print("✅ Database indexes verified successfully.")
    except Exception as e:
        print(f"⚠️ WARNING: Failed to create database indexes: {e}")
        print("This might be due to a connection issue or existing duplicate data.")