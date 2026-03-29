import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/Colors';

interface PinPointLogoProps {
  size?: number;
}

const POINT_LAYOUT = [
  { name: 'caret-up-sharp' as const, top: 0.02, left: 0.445, rotation: '0deg', color: '#2AB8FF' },
  { name: 'caret-up-sharp' as const, top: 0.165, left: 0.16, rotation: '-62deg', color: '#1399F2' },
  { name: 'caret-up-sharp' as const, top: 0.165, left: 0.73, rotation: '62deg', color: '#17C0B8' },
  { name: 'caret-up-sharp' as const, top: 0.42, left: 0.02, rotation: '-90deg', color: '#0F6DD3' },
  { name: 'caret-up-sharp' as const, top: 0.42, left: 0.885, rotation: '90deg', color: '#19D2B4' },
];

export default function PinPointLogo({ size = 96 }: PinPointLogoProps) {
  const outerSize = size;
  const compassSize = size * 0.9;
  const globeWidth = size * 0.72;
  const globeHeight = size * 0.41;
  const pinSize = size * 0.34;

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize }]}> 
      <View
        style={[
          styles.compassArc,
          {
            width: compassSize,
            height: compassSize * 0.48,
            borderTopLeftRadius: compassSize * 0.45,
            borderTopRightRadius: compassSize * 0.45,
            borderWidth: Math.max(3, size * 0.04),
          },
        ]}
      />

      {POINT_LAYOUT.map((point) => (
        <View
          key={`${point.name}-${point.top}-${point.left}`}
          style={[
            styles.point,
            {
              top: point.top * outerSize,
              left: point.left * outerSize,
              transform: [{ rotate: point.rotation }],
            },
          ]}
        >
          <Ionicons name={point.name} size={Math.max(12, size * 0.12)} color={point.color} />
        </View>
      ))}

      <View
        style={[
          styles.globeShell,
          {
            width: globeWidth,
            height: globeHeight,
            borderTopLeftRadius: globeWidth / 2,
            borderTopRightRadius: globeWidth / 2,
            borderBottomLeftRadius: globeWidth * 0.22,
            borderBottomRightRadius: globeWidth * 0.22,
            bottom: size * 0.09,
            borderWidth: Math.max(3, size * 0.035),
          },
        ]}
      >
        <View style={styles.globeLeft} />
        <View style={styles.globeRight} />
        <View style={[styles.latitude, styles.latitudeUpper]} />
        <View style={[styles.latitude, styles.latitudeMiddle]} />
        <View style={[styles.longitude, styles.longitudeLeft]} />
        <View style={[styles.longitude, styles.longitudeCenter]} />
        <View style={[styles.longitude, styles.longitudeRight]} />
      </View>

      <View style={[styles.pinWrap, { top: size * 0.22 }]}> 
        <View style={styles.pinShadow} />
        <Ionicons name="location-sharp" size={pinSize} color="#129EF0" style={styles.pinIcon} />
        <View
          style={[
            styles.pinHole,
            {
              width: pinSize * 0.24,
              height: pinSize * 0.24,
              borderRadius: pinSize * 0.12,
              top: pinSize * 0.24,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compassArc: {
    position: 'absolute',
    top: '8%',
    alignSelf: 'center',
    borderColor: '#1580E0',
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  point: {
    position: 'absolute',
  },
  globeShell: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#0D2D49',
    borderColor: '#0F6DD3',
  },
  globeLeft: {
    ...StyleSheet.absoluteFillObject,
    right: '42%',
    backgroundColor: '#1199DF',
  },
  globeRight: {
    ...StyleSheet.absoluteFillObject,
    left: '46%',
    backgroundColor: '#8DDB25',
  },
  latitude: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    borderTopWidth: 2,
    borderColor: 'rgba(7, 26, 38, 0.75)',
  },
  latitudeUpper: {
    top: '28%',
  },
  latitudeMiddle: {
    top: '56%',
  },
  longitude: {
    position: 'absolute',
    top: '8%',
    bottom: '4%',
    width: 2,
    backgroundColor: 'rgba(7, 26, 38, 0.8)',
    borderRadius: 999,
  },
  longitudeLeft: {
    left: '26%',
  },
  longitudeCenter: {
    left: '50%',
  },
  longitudeRight: {
    left: '74%',
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinShadow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18, 158, 240, 0.22)',
    transform: [{ scaleX: 1.05 }, { scaleY: 0.82 }],
  },
  pinIcon: {
    textShadowColor: 'rgba(7, 26, 38, 0.45)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 10,
  },
  pinHole: {
    position: 'absolute',
    backgroundColor: Brand.midnight,
  },
});