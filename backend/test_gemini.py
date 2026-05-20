# import google.generativeai as genai
# import os
# from dotenv import load_dotenv

# # Force load the .env file
# load_dotenv()

# key = os.getenv("GEMINI_API_KEY")
# print(f"1. API Key loaded from .env: {key}")

# if not key:
#     print("❌ ERROR: Could not find GEMINI_API_KEY. Check your .env file!")
# else:
#     try:
#         genai.configure(api_key=key)
#         model = genai.GenerativeModel('gemini-1.5-flash')
#         print("2. Attempting to contact Google...")
        
#         response = model.generate_content("Say the word 'Hello'")
#         print(f"3. ✅ SUCCESS! Google responded: {response.text}")
        
#     except Exception as e:
#         print(f"3. ❌ GOOGLE REJECTED THE REQUEST. Reason: {e}")