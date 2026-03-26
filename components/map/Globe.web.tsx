import { BoundingBox, Coordinates } from '@/types/game';
import React, { useEffect, useRef, useState } from 'react';

interface GlobeProps {
  onLocationSelect: (coords: Coordinates) => void;
  guessMarker?: Coordinates | null;
  targetMarker?: Coordinates | null;
  targetBounds?: BoundingBox | null;
  showArc?: boolean;
  disabled?: boolean;
  onErrorChange?: (message: string | null) => void;
}

// Track if Google Maps script is loading/loaded
let isScriptLoading = false;
let isScriptLoaded = false;
const loadCallbacks: Array<() => void> = [];
const loadErrorCallbacks: Array<(error: Error) => void> = [];

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isScriptLoaded) {
      resolve();
      return;
    }

    loadCallbacks.push(resolve);
    loadErrorCallbacks.push(reject);

    if (isScriptLoading) {
      return;
    }

    isScriptLoading = true;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isScriptLoaded = true;
      isScriptLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
      loadErrorCallbacks.length = 0;
    };
    script.onerror = () => {
      const error = new Error('google_maps_script_failed');
      isScriptLoading = false;
      loadErrorCallbacks.forEach((cb) => cb(error));
      loadCallbacks.length = 0;
      loadErrorCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export default function Globe({
  onLocationSelect,
  guessMarker,
  targetMarker,
  targetBounds,
  showArc = false,
  disabled = false,
  onErrorChange,
}: GlobeProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const guessMarkerRef = useRef<google.maps.Marker | null>(null);
  const targetMarkerRef = useRef<google.maps.Marker | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const boundsRectRef = useRef<google.maps.Rectangle | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Initialize map
  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file.');
      return;
    }

    setError(null);
    setIsReady(false);

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapTypeId: 'satellite',
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          // Hide all labels on satellite view
          styles: [
            {
              featureType: 'all',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'administrative',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'road',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'transit',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'water',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        mapRef.current = map;
        setIsReady(true);
        setError(null);
      })
      .catch((err) => {
        setError('Failed to load Google Maps. Check your connection and try again.');
        console.error(err);
      });

    return () => {
      // Cleanup markers
      guessMarkerRef.current?.setMap(null);
      targetMarkerRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
    };
  }, [apiKey]);

  useEffect(() => {
    onErrorChange?.(error);
  }, [error, onErrorChange]);

  // Handle map clicks
  useEffect(() => {
    if (!mapRef.current || !isReady) return;

    const listener = mapRef.current.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (disabled || !event.latLng) return;
      onLocationSelect({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      });
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [isReady, disabled, onLocationSelect]);

  // Update guess marker
  useEffect(() => {
    if (!mapRef.current || !isReady) return;

    if (guessMarker) {
      if (!guessMarkerRef.current) {
        guessMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position: { lat: guessMarker.lat, lng: guessMarker.lng },
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
                <circle cx="12" cy="12" r="10" fill="#FF6B6B" stroke="white" stroke-width="2"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
          },
        });
      } else {
        guessMarkerRef.current.setPosition({ lat: guessMarker.lat, lng: guessMarker.lng });
        guessMarkerRef.current.setMap(mapRef.current);
      }
    } else {
      guessMarkerRef.current?.setMap(null);
    }
  }, [guessMarker, isReady]);

  // Update target marker
  useEffect(() => {
    if (!mapRef.current || !isReady) return;

    if (targetMarker) {
      if (!targetMarkerRef.current) {
        targetMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position: { lat: targetMarker.lat, lng: targetMarker.lng },
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
                <circle cx="12" cy="12" r="10" fill="#4ECDC4" stroke="white" stroke-width="2"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
          },
        });
      } else {
        targetMarkerRef.current.setPosition({ lat: targetMarker.lat, lng: targetMarker.lng });
        targetMarkerRef.current.setMap(mapRef.current);
      }
    } else {
      targetMarkerRef.current?.setMap(null);
    }
  }, [targetMarker, isReady]);

  // Update target bounds rectangle
  useEffect(() => {
    if (!mapRef.current || !isReady) return;

    if (targetBounds) {
      if (!boundsRectRef.current) {
        boundsRectRef.current = new google.maps.Rectangle({
          map: mapRef.current,
          bounds: {
            north: targetBounds.nw.lat,
            south: targetBounds.se.lat,
            east: targetBounds.se.lng,
            west: targetBounds.nw.lng,
          },
          strokeColor: '#4ECDC4',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#4ECDC4',
          fillOpacity: 0.15,
        });
      } else {
        boundsRectRef.current.setBounds({
          north: targetBounds.nw.lat,
          south: targetBounds.se.lat,
          east: targetBounds.se.lng,
          west: targetBounds.nw.lng,
        });
        boundsRectRef.current.setMap(mapRef.current);
      }
    } else {
      boundsRectRef.current?.setMap(null);
    }
  }, [targetBounds, isReady]);

  // Update arc polyline
  useEffect(() => {
    if (!mapRef.current || !isReady) return;

    if (showArc && guessMarker && targetMarker) {
      const path: Array<{ lat: number; lng: number }> = [];
      const numPoints = 50;

      // Normalize longitude difference to shortest arc across date line
      let lngDiff = targetMarker.lng - guessMarker.lng;
      if (lngDiff > 180) {
        lngDiff -= 360;
      } else if (lngDiff < -180) {
        lngDiff += 360;
      }

      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        path.push({
          lat: guessMarker.lat + (targetMarker.lat - guessMarker.lat) * t,
          lng: guessMarker.lng + lngDiff * t,
        });
      }

      if (!polylineRef.current) {
        polylineRef.current = new google.maps.Polyline({
          map: mapRef.current,
          path,
          strokeColor: '#FFE66D',
          strokeWeight: 3,
          strokeOpacity: 0.8,
        });
      } else {
        polylineRef.current.setPath(path);
        polylineRef.current.setMap(mapRef.current);
      }
    } else {
      polylineRef.current?.setMap(null);
    }
  }, [showArc, guessMarker, targetMarker, isReady]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#1a365d',
        color: 'white',
        padding: 20,
        textAlign: 'center',
      }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1a365d',
      }}
    />
  );
}
