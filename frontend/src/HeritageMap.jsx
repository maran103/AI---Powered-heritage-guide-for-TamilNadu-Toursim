import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, ZoomControl } from 'react-leaflet';
import { getHeritageSites, getFestivals } from './api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;



// Centers map on Tamil Nadu by default
const TAMIL_NADU_CENTER = [11.1271, 78.6569];

function ChangeView({ center, zoom }) {
    const map = useMap();

    useEffect(() => {
        if (center) {
            map.setView(center, zoom);
            // Force Leaflet to recalculate its size after a short delay
            const timer = setTimeout(() => {
                map.invalidateSize();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [center, zoom, map]);

    return null;
}

const HeritageMap = ({ userLocation, visitedSites = [], onToggleVisit }) => {
    const [heritageSites, setHeritageSites] = useState([]);
    const [festivals, setFestivals] = useState([]);
    const [startPoint, setStartPoint] = useState(null);
    const [endPoint, setEndPoint] = useState(null);
    const [startQuery, setStartQuery] = useState("");
    const [endQuery, setEndQuery] = useState("");
    const [route, setRoute] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const searchLocation = async (query, isStart) => {
        if (!query.trim()) return;
        setIsSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
                headers: { 'User-Agent': 'HeritageAI-Assistant/1.0' }
            });
            const data = await response.json();
            if (data && data.length > 0) {
                const point = {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon),
                    name: data[0].display_name
                };
                if (isStart) {
                    setStartPoint(point);
                    setStartQuery(data[0].display_name);
                } else {
                    setEndPoint(point);
                    setEndQuery(data[0].display_name);
                }
            } else {
                alert("Location not found");
            }
        } catch (error) {
            console.error("Geocoding error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const getRoute = async () => {
        if (!startPoint || !endPoint) return;
        try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startPoint.lon},${startPoint.lat};${endPoint.lon},${endPoint.lat}?overview=full&geometries=geojson`);
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                setRoute(data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]));
            }
        } catch (error) {
            console.error("Routing error:", error);
        }
    };

    const useCurrentLocation = () => {
        if (userLocation && userLocation.latitude) {
            const point = {
                lat: parseFloat(userLocation.latitude),
                lon: parseFloat(userLocation.longitude),
                name: "Your Location"
            };
            setStartPoint(point);
            setStartQuery("Your Current Location");
        } else {
            alert("Location data not available");
        }
    };

    const clearRoute = () => {
        setStartPoint(null);
        setEndPoint(null);
        setStartQuery("");
        setEndQuery("");
        setRoute(null);
    };

    useEffect(() => {
        const loadData = async () => {
            const sitesData = await getHeritageSites();
            setHeritageSites(sitesData);

            const festivalsData = await getFestivals();
            setFestivals(festivalsData);
        };
        loadData();
    }, []);

    // Determine center and zoom based on location
    const center = (userLocation && userLocation.latitude && !isNaN(parseFloat(userLocation.latitude)))
        ? [parseFloat(userLocation.latitude), parseFloat(userLocation.longitude)]
        : TAMIL_NADU_CENTER;

    const zoom = (userLocation && userLocation.latitude && !isNaN(parseFloat(userLocation.latitude)) && !route) ? 12 : 7;

    return (
        <div className="map-wrapper" style={{ height: '600px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #444', backgroundColor: '#222', position: 'relative' }}>
            {/* Routing Control Panel */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 1000,
                backgroundColor: 'rgba(34, 34, 34, 0.9)',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #444',
                width: '300px',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
            }}>
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                        <input
                            type="text"
                            placeholder="Starting point..."
                            value={startQuery}
                            onChange={(e) => setStartQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchLocation(startQuery, true)}
                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
                        />
                        <button
                            onClick={useCurrentLocation}
                            title="Use Current Location"
                            style={{ padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: '#444', color: 'white', cursor: 'pointer' }}
                        >📍</button>
                    </div>
                    <input
                        type="text"
                        placeholder="Destination..."
                        value={endQuery}
                        onChange={(e) => setEndQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchLocation(endQuery, false)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white', marginBottom: '10px' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => { searchLocation(startQuery, true); searchLocation(endQuery, false); }}
                        style={{ flex: 1, padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                    >Search Points</button>
                    <button
                        onClick={getRoute}
                        disabled={!startPoint || !endPoint}
                        style={{ flex: 1, padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: (!startPoint || !endPoint) ? 0.5 : 1 }}
                    >Get Route</button>
                </div>
                {route && (
                    <button
                        onClick={clearRoute}
                        style={{ width: '100%', marginTop: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                    >Clear Route</button>
                )}
            </div>
            <MapContainer
                center={center}
                zoom={zoom}
                scrollWheelZoom={true}
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
            >
                <ZoomControl position="topright" />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {userLocation && userLocation.latitude && !isNaN(parseFloat(userLocation.latitude)) && (
                    <Marker position={[parseFloat(userLocation.latitude), parseFloat(userLocation.longitude)]}>
                        <Popup>
                            <strong>Your Current Location</strong>
                        </Popup>
                    </Marker>
                )}

                {heritageSites.map(site => {
                    const isVisited = visitedSites.includes(site.name);
                    return (
                        <Marker key={site.id || site.name} position={site.coords}>
                            <Popup>
                                <div className="map-popup">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                        <h3 style={{ margin: 0, color: '#1a1a1a' }}>{site.name}</h3>
                                        {isVisited && (
                                            <span style={{ backgroundColor: '#10a37f', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                                                ✅ Visited
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.9em', color: '#333' }}>{site.city}</p>
                                    <p style={{ margin: 0, fontSize: '0.8em', color: '#666' }}>{site.description}</p>

                                    <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                        <button
                                            onClick={() => {
                                                setEndPoint({ lat: site.coords[0], lon: site.coords[1], name: site.name });
                                                setEndQuery(site.name);
                                            }}
                                            style={{ flex: 1, padding: '5px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >Navigate</button>
                                        <button
                                            onClick={() => onToggleVisit(site.name)}
                                            style={{ flex: 1, padding: '5px', borderRadius: '4px', border: `1px solid ${isVisited ? '#ccc' : 'var(--primary)'}`, backgroundColor: isVisited ? '#f5f5f5' : 'transparent', color: isVisited ? '#666' : 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            {isVisited ? 'Unmark Visit' : 'Mark Visited'}
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {festivals.map(fest => (
                    <Marker
                        key={`fest-${fest.id || fest.name}`}
                        position={fest.coords}
                    >
                        <Popup>
                            <div className="map-popup">
                                <h3 style={{ margin: '0 0 5px 0', color: '#eab308' }}>🎊 {fest.name}</h3>
                                <p style={{ margin: '0 0 5px 0', fontSize: '0.9em', color: '#333' }}>{fest.location} • {fest.date}</p>
                                <p style={{ margin: 0, fontSize: '0.8em', color: '#666' }}>{fest.description}</p>
                                <button
                                    onClick={() => {
                                        setEndPoint({ lat: fest.coords[0], lon: fest.coords[1], name: fest.name });
                                        setEndQuery(fest.name);
                                    }}
                                    style={{ marginTop: '10px', width: '100%', padding: '5px', borderRadius: '4px', border: 'none', backgroundColor: '#eab308', color: 'black', cursor: 'pointer', fontWeight: 'bold' }}
                                >Set as Destination</button>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {startPoint && (
                    <Marker position={[startPoint.lat, startPoint.lon]} icon={L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41], className: 'hue-rotate-blue' })}>
                        <Popup>Start: {startPoint.name}</Popup>
                    </Marker>
                )}

                {endPoint && (
                    <Marker position={[endPoint.lat, endPoint.lon]} icon={L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41], className: 'hue-rotate-red' })}>
                        <Popup>Destination: {endPoint.name}</Popup>
                    </Marker>
                )}

                {route && (
                    <Polyline positions={route} color="#2563eb" weight={5} opacity={0.7} dashArray="10, 10" />
                )}

                <ChangeView center={center} zoom={zoom} />
            </MapContainer>
        </div>
    );
};

export default HeritageMap;
