// FIX: Add a triple-slash directive to bring in Google Maps types.
/// <reference types="@types/google.maps" />

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { routeData } from './data';
import type { Stop, Progress } from './types';
import { MapComponent } from './components/MapComponent';
import { Header } from './components/Header';
import { StopsPanel } from './components/StopsPanel';
import { Footer } from './components/Footer';

const App: React.FC = () => {
    const [stops] = useState<Stop[]>(() => routeData.stops.sort((a, b) => a.order - b.order));
    const [progress, setProgress] = useState<Progress>(() => {
        try {
            const saved = localStorage.getItem('tapas_progress');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('tapas_theme');
        if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });
    const [nextStopId, setNextStopId] = useState<string | null>(() => {
        const saved = localStorage.getItem('tapas_nextStopId');
        return saved ?? stops[0]?.id ?? null;
    });
    const [userPosition, setUserPosition] = useState<google.maps.LatLngLiteral | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    const findNextStop = useCallback((currentProgress: Progress) => {
        return stops.find(stop => !currentProgress[stop.id])?.id ?? null;
    }, [stops]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('tapas_theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('tapas_progress', JSON.stringify(progress));
    }, [progress]);

    useEffect(() => {
        if (nextStopId) {
            localStorage.setItem('tapas_nextStopId', nextStopId);
        } else {
            localStorage.removeItem('tapas_nextStopId');
        }
    }, [nextStopId]);
    
    useEffect(() => {
      const handleMapReady = () => setIsMapReady(true);
      window.addEventListener('google-maps-ready', handleMapReady);
      return () => window.removeEventListener('google-maps-ready', handleMapReady);
    }, []);

    useEffect(() => {
        if (!navigator.geolocation) {
            setGeoError("La geolocalización no es compatible con tu navegador.");
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setUserPosition({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setGeoError(null);
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    setGeoError("Permiso de geolocalización denegado. Algunas funciones estarán desactivadas.");
                } else {
                    setGeoError("Error al obtener tu ubicación.");
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const toggleDone = (stopId: string) => {
        const newProgress = { ...progress, [stopId]: !progress[stopId] };
        setProgress(newProgress);

        if (stopId === nextStopId && newProgress[stopId]) {
            setNextStopId(findNextStop(newProgress));
        }
    };

    const handleGoToStop = (stopId: string) => {
        setNextStopId(stopId);
        const element = document.getElementById(`stop-${stopId}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    
    const handleNextStop = () => {
        const nextId = findNextStop(progress);
        if (nextId) {
            handleGoToStop(nextId);
        } else {
            // All stops are completed
            alert("¡Felicidades, has completado la ruta!");
        }
    };

    const handleReset = () => {
        if (window.confirm("¿Seguro que quieres reiniciar todo el progreso?")) {
            setProgress({});
            setNextStopId(stops[0]?.id ?? null);
        }
    };

    const completedCount = useMemo(() => Object.values(progress).filter(Boolean).length, [progress]);

    return (
        <div className="flex flex-col lg:flex-row h-screen font-sans text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900">
            <main className="lg:w-[var(--panel-width-desktop)] lg:h-screen flex flex-col flex-shrink-0">
                <Header
                    title={routeData.meta.title}
                    completedCount={completedCount}
                    totalCount={stops.length}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                    onReset={handleReset}
                    onNextStop={handleNextStop}
                />
                
                {geoError && <div className="p-2 text-center bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-sm">{geoError}</div>}

                <StopsPanel
                    stops={stops}
                    progress={progress}
                    nextStopId={nextStopId}
                    onToggleDone={toggleDone}
                    onGoToStop={handleGoToStop}
                />

                <Footer />
            </main>
            <div id="map" className="w-full h-[var(--map-height-mobile)] lg:h-full lg:flex-grow order-first lg:order-last">
              {isMapReady ? (
                  <MapComponent
                      meta={routeData.meta}
                      stops={stops}
                      userPosition={userPosition}
                      nextStopId={nextStopId}
                      onMarkerClick={handleGoToStop}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                    <p className="text-gray-600 dark:text-gray-400">Cargando mapa...</p>
                  </div>
                )
              }
            </div>
        </div>
    );
};

export default App;