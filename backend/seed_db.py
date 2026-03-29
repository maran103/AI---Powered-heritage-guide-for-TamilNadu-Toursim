from mongo_database import MongoDatabase
import os
from dotenv import load_dotenv

load_dotenv()

def seed_data():
    db = MongoDatabase()
    print("Connecting to MongoDB...")
    if not db.connect():
        print("Failed to connect to MongoDB. Please check your connection strings and IP whitelist.")
        return

    # 1. Seed Festivals
    festivals = [
        {
            "id": 1,
            "name": "Chithirai Festival", 
            "temple": "Meenakshi Amman Temple",
            "location": "Madurai", 
            "coords": [9.9195, 78.1193],
            "month": "April-May",
            "date": "April 2026", 
            "description": "The celestial wedding of Goddess Meenakshi. A 15-day celebration that brings millions to Madurai."
        },
        {
            "id": 2,
            "name": "Mahamaham", 
            "temple": "Mahamaham Tank",
            "location": "Kumbakonam", 
            "coords": [10.9584, 79.3850],
            "month": "Feb-March",
            "date": "Next major event in 2028 (Annual rituals in 2026)", 
            "description": "A sacred bath in the Mahamaham tank. It is considered the 'Kumbh Mela' of the South."
        },
        {
            "id": 3,
            "name": "Thyagaraja Aradhana", 
            "temple": "Saint Thyagaraja Samadhi",
            "location": "Thiruvaiyaru", 
            "coords": [10.8803, 79.1026],
            "month": "January",
            "date": "January 2026", 
            "description": "A world-renowned Carnatic music festival where hundreds of musicians sing the 'Pancharatna Kritis' in unison."
        },
        {
            "id": 4,
            "name": "Natyanjali", 
            "temple": "Nataraja Temple",
            "location": "Chidambaram", 
            "coords": [11.3995, 79.6935],
            "month": "Feb-March (Mahashivratri)",
            "date": "February 2026", 
            "description": "A grand festival of dance dedicated to Lord Nataraja, the cosmic dancer."
        },
        {
            "id": 5,
            "name": "Arudra Darshanam", 
            "temple": "Chidambaram Nataraja Temple",
            "location": "Chidambaram", 
            "coords": [11.3995, 79.6935],
            "month": "December-January",
            "date": "January 2026", 
            "description": "Celebrates the cosmic dance of Lord Shiva. The most auspicious day for Nataraja."
        },
        {
            "id": 6,
            "name": "Karthigai Deepam",
            "temple": "Arunachaleswarar Temple",
            "location": "Tiruvannamalai",
            "coords": [12.2319, 79.0676],
            "month": "November-December",
            "date": "November 2025",
            "description": "The lighting of the giant flame atop the Annamalai hill, symbolizing the infinite pillar of fire. The beacon can be seen from many kilometres away."
        },
        {
            "id": 7,
            "name": "Vaikunda Ekadasi",
            "temple": "Ranganathaswamy Temple",
            "location": "Srirangam",
            "coords": [10.8661, 78.6942],
            "month": "December-January",
            "date": "December 2025",
            "description": "Opening of the Paramapada Vasal (Gate to Paradise). Thousands of pilgrims pass through the sacred gate seeking moksha."
        },
        {
            "id": 8,
            "name": "Kanda Sashti",
            "temple": "Subramanya Swamy Temple",
            "location": "Tiruchendur",
            "coords": [8.4965, 78.1278],
            "month": "October-November",
            "date": "November 2025",
            "description": "Commemorates the victory of Lord Murugan over the demon Surapadman. Includes the grand Soorasamharam event on the beach."
        },
        {
            "id": 9,
            "name": "Panguni Uthiram",
            "temple": "Kapaleeshwarar Temple",
            "location": "Mylapore, Chennai",
            "coords": [13.0334, 80.2694],
            "month": "March-April",
            "date": "March 2026",
            "description": "A festival celebrating the divine marriages of major deities across Tamil Nadu temples. Grand chariot processions fill the streets."
        },
        {
            "id": 10,
            "name": "Aadi Perukku",
            "temple": "Amma Mandapam Ghats",
            "location": "Srirangam",
            "coords": [10.8587, 78.6890],
            "month": "August",
            "date": "August 2025",
            "description": "A harvest festival of gratitude to the River Cauvery for its life-sustaining waters. Women offer flowers and prayers at the river banks."
        }
    ]


    print(f"Seeding {len(festivals)} festivals...")
    db.db['festivals'].drop() # Reset
    db.db['festivals'].insert_many(festivals)

    # 2. Seed Heritage Sites
    heritage_sites = [
        { "name": "Brihadisvara Temple", "city": "Thanjavur", "coords": [10.7828, 79.1318], "description": "A UNESCO World Heritage site built by Raja Raja Chola I." },
        { "name": "Meenakshi Amman Temple", "city": "Madurai", "coords": [9.9195, 78.1193], "description": "The historic heart of Madurai, dedicated to Meenakshi and Sundareswarar." },
        { "name": "Shore Temple", "city": "Mahabalipuram", "coords": [12.6163, 80.1929], "description": "An 8th-century structural temple overlooking the Bay of Bengal." },
        { "name": "Ranganathaswamy Temple", "city": "Srirangam", "coords": [10.8661, 78.6942], "description": "One of the largest functioning religious complexes in the world." },
        { "name": "Vivekananda Rock Memorial", "city": "Kanyakumari", "coords": [8.0781, 77.5553], "description": "A popular pilgrimage and tourist attraction built in honor of Swami Vivekananda." }
    ]

    print(f"Seeding {len(heritage_sites)} heritage sites...")
    db.db['heritage_sites'].drop() # Reset
    db.db['heritage_sites'].insert_many(heritage_sites)

    print("✓ Seeding complete!")

if __name__ == "__main__":
    seed_data()
