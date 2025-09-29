// FIX: Add a triple-slash directive to bring in Google Maps types.
/// <reference types="@types/google.maps" />

import React, { useEffect, useRef } from 'react';
import type { Stop, RouteMeta } from '../types';

interface MapComponentProps {
    meta: RouteMeta;
    stops: Stop[];
    userPosition: google.maps.LatLngLiteral | null;
    nextStopId: string | null;
    onMarkerClick: (stopId: string) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({ meta, stops, userPosition, nextStopId, onMarkerClick }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMap = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<Record<string, google.maps.Marker>>({});
    const userMarkerRef = useRef<google.maps.Marker | null>(null);
    const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current || !window.google) return;
        
        const mapOptions: google.maps.MapOptions = {
            center: { lat: meta.start.lat, lng: meta.start.lng },
            zoom: 15,
            mapId: 'GRANADA_TAPAS_ROUTE_MAP',
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
        };

        const map = new google.maps.Map(mapRef.current, mapOptions);
        googleMap.current = map;
        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({ map, suppressMarkers: true });
        infoWindowRef.current = new google.maps.InfoWindow();

        // Cleanup on unmount
        return () => {
            googleMap.current = null;
            Object.values(markersRef.current).forEach(marker => marker.setMap(null));
            markersRef.current = {};
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Create markers for stops
    useEffect(() => {
        if (!googleMap.current) return;
        const map = googleMap.current;

        const flagIcon = {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" width="36px" height="36px"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>'
            )}`,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(6, 32),
        };

        // Clear old markers
        Object.values(markersRef.current).forEach(marker => marker.setMap(null));
        markersRef.current = {};

        // Start Flag
        const startMarker = new google.maps.Marker({
            position: meta.start,
            map,
            title: meta.start.name,
            icon: flagIcon,
            zIndex: 10,
        });
        markersRef.current['start'] = startMarker;

        // End Flag
        const endMarker = new google.maps.Marker({
            position: meta.end,
            map,
            title: meta.end.name,
            icon: flagIcon,
            zIndex: 10,
        });
        markersRef.current['end'] = endMarker;
        
        // Stop markers
        stops.forEach(stop => {
            const marker = new google.maps.Marker({
                position: { lat: stop.lat, lng: stop.lng },
                map,
                title: stop.name,
                label: {
                    text: `${stop.order}`,
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                },
            });

            marker.addListener('click', () => {
                onMarkerClick(stop.id);
                if (infoWindowRef.current) {
                    infoWindowRef.current.setContent(`
                      <div class="p-2 font-sans">
                        <h3 class="font-bold text-md text-gray-800">${stop.name}</h3>
                        <p class="text-sm text-gray-600">Tapa: ${stop.tapa}</p>
                      </div>
                    `);
                    infoWindowRef.current.open(map, marker);
                }
            });
            markersRef.current[stop.id] = marker;
        });

    }, [googleMap, stops, meta, onMarkerClick]);

    // Update Directions
    useEffect(() => {
        if (!directionsServiceRef.current || !directionsRendererRef.current || !userPosition || !nextStopId) {
            // Draw a full polyline if no user position or next stop is active
            if (directionsServiceRef.current && directionsRendererRef.current && stops.length > 1) {
                const waypoints = stops.slice(0, -1).map(s => ({ location: new google.maps.LatLng(s.lat, s.lng), stopover: true }));
                directionsServiceRef.current.route({
                    origin: { lat: meta.start.lat, lng: meta.start.lng },
                    destination: { lat: meta.end.lat, lng: meta.end.lng },
                    waypoints: waypoints,
                    travelMode: google.maps.TravelMode.WALKING,
                }, (result, status) => {
                    if (status === 'OK' && directionsRendererRef.current) {
                        directionsRendererRef.current.setDirections(result);
                    }
                });
            }
            return;
        }

        const nextStop = stops.find(s => s.id === nextStopId);
        if (!nextStop) return;

        directionsServiceRef.current.route({
            origin: userPosition,
            destination: { lat: nextStop.lat, lng: nextStop.lng },
            travelMode: google.maps.TravelMode.WALKING,
        }, (result, status) => {
            if (status === 'OK' && directionsRendererRef.current) {
                directionsRendererRef.current.setDirections(result);
            }
        });
    }, [userPosition, nextStopId, stops, meta]);


    // Update User Position Marker
    useEffect(() => {
        if (!googleMap.current || !userPosition) return;

        if (!userMarkerRef.current) {
            userMarkerRef.current = new google.maps.Marker({
                position: userPosition,
                map: googleMap.current,
                title: 'Tu ubicación',
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4285F4',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                },
                zIndex: 100,
            });
        } else {
            userMarkerRef.current.setPosition(userPosition);
        }
    }, [userPosition]);
    
    // Animate marker for next stop
    useEffect(() => {
        Object.values(markersRef.current).forEach(marker => marker.setAnimation(null));
        if (nextStopId && markersRef.current[nextStopId]) {
            markersRef.current[nextStopId].setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => {
                if (markersRef.current[nextStopId]) {
                     markersRef.current[nextStopId].setAnimation(null);
                }
            }, 2200);
        }
    }, [nextStopId]);

    return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};