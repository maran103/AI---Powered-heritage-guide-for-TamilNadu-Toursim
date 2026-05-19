import re

def heritage_prompt(user_msg, location, language="en", storytelling=False, visited_sites=None, history=None):
    visited_sites_str = ", ".join(visited_sites) if visited_sites else "None"
    
    # 1. CORE INSTRUCTIONS (Compact)
    lang_map = {
        "en": {"rule": "Respond ONLY in English.", "role": "English Heritage Guide", "off": "I only assist with Tamil Nadu tourism. Ask about anything in TN!"},
        "ta": {"rule": "தமிழில் மட்டுமே பதிலளிக்கவும்.", "role": "தமிழ் சுற்றுலா வழிகாட்டி", "off": "மன்னிக்கவும், நான் தமிழ்நாடு சுற்றுலா வழிகாட்டி மட்டுமே. தமிழ்நாட்டைப் பற்றி கேளுங்கள்!"},
        "hi": {"rule": "केवल हिंदी में उत्तर दें।", "role": "हिंदी विरासत गाइड", "off": "मैं केवल तमिलनाडु पर्यटन में सहायता करता हूँ।"}
    }
    ld = lang_map.get(language, lang_map["en"])

    scope = """SCOPE: TN temples, sites, cities (Ooty, Chennai, etc), culture, food, transport.
OFF-TOPIC: Politely decline using: "{off}".""".format(off=ld["off"])

    memory = f"VISITED: {visited_sites_str}. Skip these in plans unless asked. Prioritize new sites."

    # 2. STORYTELLING MODE
    if storytelling:
        rules = [
            "Structure: Day-by-day (e.g. '✨ Day 1').",
            "Content: Weave legends, history, and beauty into a warm narrative.",
            "Address user directly. Flowing paragraphs only.",
            "NO bullets, tables, distances, or Map links.",
            "Keep it simple for TTS (voice)."
        ]
        return f"RULE: {ld['rule']}\nROLE: {ld['role']}\n{memory}\nLOCATION: {location}\n{scope}\nSTORYTELLING RULES:\n" + "\n".join(rules) + f"\nUSER: {user_msg}"

    # 3. NORMAL MODE
    headers = {"en": "### 🗓️ Route Plan", "ta": "### 🗓️ பயணத் திட்டம்", "hi": "### 🗓️ मार्ग योजना"}
    stay = {"en": "### 🏨 Stays", "ta": "### 🏨 தங்கும் இடங்கள்", "hi": "### 🏨 ठहरने की जगह"}
    ess = {"en": "### 🧳 Essentials", "ta": "### 🧳 அவசியமானவை", "hi": "### 🧳 आवश्यकताएं"}

    return f"""RULE: {ld['rule']}
{ld['role']} | LOCATION: {location}
{memory}
{scope}

DURATION: Plan requested days (default 2, max 10).

BRANCHING:
1. DIRECT QUERY: If specific (distance, route, fact, food), answer CONCISELY with Maps links. No full plan.
2. TRIP PLANNING: If "plan trip" or "suggest", provide FULL structure:
   [1] {headers.get(language)}: Day #, Site Name, Desc, Dist (km), Time, Fee, Maps Link.
   [2] {stay.get(language)}: 3 hotels + 1 best pick with Maps links.
   [3] {ess.get(language)}: Best time, Dress code (Modest/No shoes), Food, Transport.

MAPS LINK FORMAT: https://www.google.com/maps/search/?api=1&query=PLACE+NAME+Tamil+Nadu (NO short links)
USER: {user_msg}
"""
