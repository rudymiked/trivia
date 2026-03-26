import { BoundingBox, Coordinates } from '@/types/game';
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// Custom map style to hide all labels
const mapStyle = [
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
];

interface GlobeProps {
  onLocationSelect: (coords: Coordinates) => void;
  guessMarker?: Coordinates | null;
  targetMarker?: Coordinates | null;
  targetBounds?: BoundingBox | null;
  showArc?: boolean;
  disabled?: boolean;
  onErrorChange?: (message: string | null) => void;
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
  const [region, setRegion] = useState({
    latitude: 20,
    longitude: 0,
    latitudeDelta: 100,
    longitudeDelta: 100,
  });

  const handleMapPress = useCallback(
    (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      if (disabled) return;
      const { latitude, longitude } = event.nativeEvent.coordinate;
      onLocationSelect({ lat: latitude, lng: longitude });
    },
    [onLocationSelect, disabled]
  );

  const arcCoordinates = React.useMemo(() => {
    if (!showArc || !guessMarker || !targetMarker) return [];

    // Create an arc path between guess and target
    const points: Array<{ latitude: number; longitude: number }> = [];
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
      const lat = guessMarker.lat + (targetMarker.lat - guessMarker.lat) * t;
      const lng = guessMarker.lng + lngDiff * t;
      // Add some arc height
      const arcHeight = Math.sin(t * Math.PI) * 10;
      points.push({
        latitude: lat + arcHeight * 0.1,
        longitude: lng,
      });
    }
    return points;
  }, [showArc, guessMarker, targetMarker]);

  React.useEffect(() => {
    onErrorChange?.(null);
  }, [onErrorChange]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        mapType="satellite"
        customMapStyle={mapStyle}
        showsUserLocation={false}
        showsCompass={true}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        rotateEnabled={true}
        pitchEnabled={true}
      >
        {targetBounds && (
          <Polygon
            coordinates={[
              { latitude: targetBounds.nw.lat, longitude: targetBounds.nw.lng },
              { latitude: targetBounds.nw.lat, longitude: targetBounds.se.lng },
              { latitude: targetBounds.se.lat, longitude: targetBounds.se.lng },
              { latitude: targetBounds.se.lat, longitude: targetBounds.nw.lng },
            ]}
            strokeColor="#4ECDC4"
            fillColor="rgba(78, 205, 196, 0.15)"
            strokeWidth={2}
          />
        )}

        {guessMarker && (
          <Marker
            coordinate={{
              latitude: guessMarker.lat,
              longitude: guessMarker.lng,
            }}
            pinColor="#FF6B6B"
            title="Your Guess"
          />
        )}

        {targetMarker && (
          <Marker
            coordinate={{
              latitude: targetMarker.lat,
              longitude: targetMarker.lng,
            }}
            pinColor="#4ECDC4"
            title="Target"
          />
        )}

        {showArc && arcCoordinates.length > 0 && (
          <Polyline
            coordinates={arcCoordinates}
            strokeColor="#FFE66D"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
