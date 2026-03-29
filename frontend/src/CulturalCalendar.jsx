import React, { useEffect, useState } from 'react';
import { getFestivals } from './api';
import './CulturalCalendar.css';

// Haversine formula to calculate distance between two lat/lng points in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const CulturalCalendar = ({ userLocation }) => {
    const [festivals, setFestivals] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFestivals = async () => {
            setLoading(true);
            const lat = userLocation?.latitude;
            const lng = userLocation?.longitude;
            const data = await getFestivals(lat, lng);

            // Attach distance to each festival if user location is available
            const enriched = data.map(fest => {
                if (lat && lng && fest.coords) {
                    const dist = getDistanceKm(lat, lng, fest.coords[0], fest.coords[1]);
                    return { ...fest, distance: Math.round(dist) };
                }
                return fest;
            });

            setFestivals(enriched);
            setLoading(false);
        };
        loadFestivals();
    }, [userLocation]);

    const closeModal = () => setSelectedEvent(null);

    return (
        <div className="calendar-container">
            <div className="calendar-header">
                <h2>📅 Cultural Events Guide</h2>
                {userLocation?.latitude && (
                    <span className="location-badge">
                        📍 Sorted by distance from your location
                    </span>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading cultural events...</div>
            ) : (
                <div className="festival-grid">
                    {festivals.map((fest, index) => (
                        <div
                            key={fest.id || fest.name}
                            className={`festival-card ${index === 0 && fest.distance !== undefined ? 'nearest' : ''}`}
                            onClick={() => setSelectedEvent(fest)}
                        >
                            {index === 0 && fest.distance !== undefined && (
                                <span className="nearest-badge">⭐ Nearest to you</span>
                            )}
                            <h3>{fest.name}</h3>
                            <div className="festival-meta">
                                <span className="meta-item location">
                                    📍 {fest.location}
                                </span>
                                <span className="meta-item">
                                    🗓️ {fest.date}
                                </span>
                                {fest.distance !== undefined && (
                                    <span className="meta-item distance-tag">
                                        🧭 {fest.distance} km away
                                    </span>
                                )}
                            </div>
                            <p className="festival-description">
                                {fest.description}
                            </p>
                            <div className="view-details">
                                View Details →
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {festivals.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                    No events found for your region currently.
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal}>
                            &times;
                        </button>

                        <h2 style={{ color: 'var(--primary)', marginTop: 0 }}>{selectedEvent.name}</h2>
                        <div className="modal-grid">
                            <div className="modal-info-item">
                                <label>Temple/Monuments:</label>
                                <span>{selectedEvent.temple || 'Various'}</span>
                            </div>
                            <div className="modal-info-item">
                                <label>Location:</label>
                                <span>{selectedEvent.location}</span>
                            </div>
                            <div className="modal-info-item">
                                <label>Date:</label>
                                <span>{selectedEvent.date}</span>
                            </div>
                            <div className="modal-info-item">
                                <label>Month:</label>
                                <span>{selectedEvent.month}</span>
                            </div>
                            {selectedEvent.distance !== undefined && (
                                <div className="modal-info-item">
                                    <label>Distance from you:</label>
                                    <span className="distance-highlight">{selectedEvent.distance} km</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-details">
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Event Description</label>
                            <p style={{ color: 'var(--text-primary)', lineHeight: '1.7', margin: 0 }}>
                                {selectedEvent.description}
                            </p>
                        </div>

                        <button className="modal-action-btn" onClick={closeModal}>
                            Close Details
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CulturalCalendar;
