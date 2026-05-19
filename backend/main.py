import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from groq import Groq
from prompt import heritage_prompt
from rag_pipeline import retrieve_context
from mongo_database import MongoDatabase
from typing import Optional
import json
from gtts import gTTS
import io
from fastapi.responses import Response


# Load environment variables
load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client and MongoDB
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
db = MongoDatabase()


@app.on_event("startup")
def on_startup_connect_db():
    print("\n" + "="*60)
    print("Starting Heritage AI Backend...")
    print("="*60)
    connected = db.connect()
    if not connected:
        print("\n⚠️  WARNING: MongoDB connection failed!")
        print("   - Check MONGO_URI in .env file")
        print("   - Ensure MongoDB cluster is running")
        print("   - Check IP whitelist on Atlas")
        print("   - Verify username/password")
        print("\nSome features will not work until database is connected.")
    print("="*60 + "\n")

# ==================== REQUEST MODELS ====================

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChatRequest(BaseModel):
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    language: str = "en"  # 'en' (English), 'ta' (Tamil), 'hi' (Hindi)
    image_base64: Optional[str] = None  # New field for heritage vision
    storytelling: bool = False

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/auth/signup")
def signup(req: SignupRequest):
    """User signup endpoint"""
    try:
        if len(req.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        result = db.create_user(
            email=req.email,
            password=req.password,
            name=req.name
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        
        return {
            "success": True,
            "message": result['message'],
            "user_id": result['user_id']
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@app.post("/auth/login")
def login(req: LoginRequest):
    """User login endpoint"""
    try:
        result = db.login_user(
            email=req.email,
            password=req.password
        )
        
        if not result['success']:
            raise HTTPException(status_code=401, detail=result['message'])
        
        return {
            "success": True,
            "user_id": result['user_id'],
            "name": result['name'],
            "email": result['email'],
            "message": result['message']
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@app.get("/auth/me")
def get_current_user(user_id: str = Header(None, alias="user-id")):
    """Get current user information"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@app.put("/auth/profile")
def update_profile(req: UpdateProfileRequest, user_id: str = Header(None, alias="user-id")):
    """Update user profile"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = db.update_user_profile(user_id, name=req.name)
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    return result

@app.put("/auth/password")
def change_password(req: ChangePasswordRequest, user_id: str = Header(None, alias="user-id")):
    """Change user password"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = db.change_password(user_id, req.old_password, req.new_password)
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    return result

# ==================== CHAT ENDPOINTS ====================

@app.post("/chat")
def chat(req: ChatRequest, user_id: str = Header(None, alias="user-id")):
    """Send a chat message with streaming response"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Please login to use chat")
    
    # Save user message
    db.save_message(
        user_id=user_id,
        message_type="user",
        content=req.message,
        latitude=req.latitude,
        longitude=req.longitude,
        image=req.image_base64
    )
    
    location = f"Latitude: {req.latitude}, Longitude: {req.longitude}"
    
    # Get chat history
    history = db.get_chat_history(user_id)
    
    # Get visited places for personalization
    visited_places = db.get_visited_places(user_id)
    
    # Generate prompt
    prompt = heritage_prompt(
        user_msg=req.message,
        location=location,
        language=req.language,
        storytelling=req.storytelling,
        history=history,
        visited_sites=visited_places
    )

    # Retrieve heritage knowledge from FAISS
    retrieved_context = retrieve_context(req.message)

    print("\n===== RETRIEVED CONTEXT =====")
    print(retrieved_context)
    print("================================\n")
    
    # Inject retrieved context into prompt
    prompt = f"""
    Use the following heritage knowledge to answer accurately.

    HERITAGE KNOWLEDGE:
    {retrieved_context}

    {prompt}
    """
    # Stream the response
    def generate_response():
        full_response = ""
        try:
            # Determine model and message content
            model = "llama-3.1-8b-instant"
            
            # Construct messages with history for context
            messages = []
            
            if req.image_base64:
                model = "llama-3.2-11b-vision-preview"
                # For vision, we use a more direct instruction
                vision_prompt = f"You are a heritage expert for Tamil Nadu. {prompt.split('BRANCHING:')[0]}"
                messages.append({"role": "system", "content": vision_prompt})
                
                # Add history (last 3 messages for vision to save tokens)
                for h_msg in history[-4:-1]:
                    role = "user" if h_msg['type'] == "user" else "assistant"
                    messages.append({"role": role, "content": h_msg['text']})
                
                # Add current vision message
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": req.message},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{req.image_base64}",
                            },
                        },
                    ],
                })
            else:
                messages.append({"role": "system", "content": prompt})
                
                # Add history (last 4 messages for better context)
                for h_msg in history[-5:-1]:
                    role = "user" if h_msg['type'] == "user" else "assistant"
                    messages.append({"role": role, "content": h_msg['text']})
                
                # Add current message
                messages.append({"role": "user", "content": req.message})

            # Scale tokens: ~500 per day, min 1500, max 3000
            import re as _re
            day_match = _re.search(r'(\d+)\s*(?:day|days|நாட்கள்|நாள்|दिन)', req.message, _re.IGNORECASE)
            num_days = int(day_match.group(1)) if day_match else 2
            num_days = min(num_days, 10)
            base_tokens = max(1500, num_days * 500)
            max_tok = int(base_tokens * 1.5) if req.language == "ta" else base_tokens
            max_tok = min(max_tok, 3000)  # Lowered cap to 3000

            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.6,
                max_tokens=max_tok,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    full_response += text
                    # Send as SSE format
                    yield f"data: {json.dumps({'text': text})}\n\n"
            
            # Save full AI response after streaming
            db.save_message(
                user_id=user_id,
                message_type="assistant",
                content=full_response
            )
        except Exception as e:
            error_msg = f"Error during AI analysis: {str(e)}"
            print(f"Streaming error: {e}")
            yield f"data: {json.dumps({'text': error_msg})}\n\n"
    
    return StreamingResponse(generate_response(), media_type="text/event-stream")

@app.get("/chat/history")
def get_history(user_id: str = Header(None, alias="user-id")):
    """Get chat history for logged-in user"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Please login to view chat history")
    
    messages = db.get_chat_history(user_id)
    message_count = db.get_message_count(user_id)
    
    return {
        "messages": messages,
        "total_count": message_count
    }

@app.delete("/chat/history")
def clear_history(user_id: str = Header(None, alias="user-id")):
    """Clear chat history for logged-in user"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = db.clear_chat_history(user_id)
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    return result

@app.delete("/auth/account")
def delete_account(user_id: str = Header(None, alias="user-id")):
    """Delete user account and all data"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = db.delete_user_account(user_id)
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    return result

# ==================== HERITAGE DATA ENDPOINTS ====================

@app.get("/heritage/festivals")
def get_festivals(lat: Optional[float] = None, lng: Optional[float] = None):
    """Get heritage festivals with optional distance sorting"""
    # Try fetching from DB first
    festivals = db.get_festivals()
    
    # Fallback if DB is empty or disconnected
    if not festivals:
        festivals = [
            {"id": 1, "name": "Chithirai Festival", "temple": "Meenakshi Amman Temple", "location": "Madurai", "coords": [9.9195, 78.1193], "month": "April-May", "date": "April 2026", "description": "The celestial wedding of Goddess Meenakshi. A 15-day celebration that brings millions to Madurai."},
            {"id": 2, "name": "Mahamaham", "temple": "Mahamaham Tank", "location": "Kumbakonam", "coords": [10.9584, 79.3850], "month": "Feb-March", "date": "Next major event in 2028", "description": "A sacred bath in the Mahamaham tank."},
            {"id": 3, "name": "Thyagaraja Aradhana", "temple": "Saint Thyagaraja Samadhi", "location": "Thiruvaiyaru", "coords": [10.8803, 79.1026], "month": "January", "date": "January 2026", "description": "A world-renowned Carnatic music festival."},
            {"id": 4, "name": "Natyanjali", "temple": "Nataraja Temple", "location": "Chidambaram", "coords": [11.3995, 79.6935], "month": "Feb-March", "date": "February 2026", "description": "A grand festival of dance dedicated to Lord Nataraja."},
            {"id": 5, "name": "Arudra Darshanam", "temple": "Chidambaram Nataraja Temple", "location": "Chidambaram", "coords": [11.3995, 79.6935], "month": "December-January", "date": "January 2026", "description": "Celebrates the cosmic dance of Lord Shiva."},
            {"id": 6, "name": "Karthigai Deepam", "temple": "Arunachaleswarar Temple", "location": "Tiruvannamalai", "coords": [12.2319, 79.0676], "month": "Nov-Dec", "date": "November 2025", "description": "Lighting of the giant flame on Annamalai hill."},
            {"id": 7, "name": "Vaikunda Ekadasi", "temple": "Ranganathaswamy Temple", "location": "Srirangam", "coords": [10.8661, 78.6942], "month": "Dec-Jan", "date": "December 2025", "description": "Opening of the Gate to Paradise."},
            {"id": 8, "name": "Kanda Sashti", "temple": "Subramanya Swamy Temple", "location": "Tiruchendur", "coords": [8.4965, 78.1278], "month": "Oct-Nov", "date": "November 2025", "description": "Victory of Lord Murugan over Surapadman."},
            {"id": 9, "name": "Panguni Uthiram", "temple": "Kapaleeshwarar Temple", "location": "Mylapore", "coords": [13.0334, 80.2694], "month": "March-April", "date": "March 2026", "description": "Celestial marriages of the deities."},
            {"id": 10, "name": "Aadi Perukku", "temple": "Amma Mandapam", "location": "Srirangam", "coords": [10.8587, 78.6890], "month": "August", "date": "August 2025", "description": "Gratitude to River Cauvery."}
        ]

    if lat is not None and lng is not None:
        def get_dist(f):
            return ((f["coords"][0] - lat)**2 + (f["coords"][1] - lng)**2)**0.5
        festivals.sort(key=get_dist)

    return festivals

@app.get("/heritage/sites")
def get_heritage_sites():
    """Get heritage sites for mapping"""
    sites = db.get_heritage_sites()
    
    if not sites:
        sites = [
            { "id": 1, "name": "Brihadisvara Temple", "city": "Thanjavur", "coords": [10.7828, 79.1318], "description": "A UNESCO World Heritage site built by Raja Raja Chola I." },
            { "id": 2, "name": "Meenakshi Amman Temple", "city": "Madurai", "coords": [9.9195, 78.1193], "description": "The historic heart of Madurai." },
            { "id": 3, "name": "Shore Temple", "city": "Mahabalipuram", "coords": [12.6163, 80.1929], "description": "An 8th-century structural temple." },
            { "id": 4, "name": "Ranganathaswamy Temple", "city": "Srirangam", "coords": [10.8661, 78.6942], "description": "One of the largest functioning religious complexes." },
            { "id": 5, "name": "Vivekananda Rock Memorial", "city": "Kanyakumari", "coords": [8.0781, 77.5553], "description": "A popular pilgrimage and tourist attraction." }
        ]
    return sites

class VisitedPlaceRequest(BaseModel):
    site_name: str

# ==================== VISIT MEMORY ENDPOINTS ====================

@app.post("/user/visit")
async def add_visit(request: VisitedPlaceRequest, user_id: str = Header(None, alias="user-id")):
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    result = db.add_visited_place(user_id, request.site_name)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result

@app.delete("/user/visit")
async def remove_visit(site_name: str, user_id: str = Header(None, alias="user-id")):
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    result = db.remove_visited_place(user_id, site_name)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result

@app.get("/user/visited")
async def get_visited(user_id: str = Header(None, alias="user-id")):
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    visited = db.get_visited_places(user_id)
    return {"visited_places": visited}

# ==================== TTS ENDPOINTS ====================

@app.get("/tts")
def get_tts(text: str, lang: str = "en"):
    """Text-to-speech fallback endpoint using Google TTS"""
    try:
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
            
        print(f"Generating TTS for lang: {lang}, text length: {len(text)}")
        
        # Create gTTS object
        tts = gTTS(text=text, lang=lang)
        
        # Write to memory buffer
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        
        # Return as audio/mpeg
        return Response(content=fp.read(), media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== HEALTH CHECK ====================

@app.get("/")
def root():
    return {
        "status": "Heritage AI backend running with MongoDB",
        "version": "2.0",
        "features": ["user_auth", "chat_history", "location_tracking"]
    }
