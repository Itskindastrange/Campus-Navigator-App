// screens/ResultScreen.js
import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, Dimensions, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'; // Import MapView
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const mock_landmarks = {
  'Civil':     {'latitude': 31.481986801343748, 'longitude': 74.30364459192805},
  'CS':        {'latitude': 31.48115970726234,  'longitude': 74.30288450189659},
  'EE':        {'latitude': 31.48106738002753,  'longitude': 74.3033040174629},
  'Gate 5':    {'latitude': 31.48079536833649,  'longitude': 74.30415120439103},
  'Library':   {'latitude': 31.481559513821388, 'longitude': 74.30379489883944},
  'NB':        {'latitude': 31.480306772468865, 'longitude': 74.30395136592784},
  'Old cafe':  {'latitude': 31.481028590362214, 'longitude': 74.30391442211119},
  'Wuzu':      {'latitude': 31.481380587602427, 'longitude': 74.30330995882208},
  'Main':      {'latitude': 31.4816111,          'longitude': 74.3029722},
};

export default function ResultScreen({ route, navigation }) {
  const { resultData } = route.params; // Get data passed from HomeScreen
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Check if we have coordinates to display the map
  const hasUserCoords = resultData?.userCoords?.latitude && resultData?.userCoords?.longitude;
  const hasLandmarkCoords = resultData?.landmarkCoords?.latitude && resultData?.landmarkCoords?.longitude;
  const canShowMap = hasUserCoords && hasLandmarkCoords;

  const initialRegion = canShowMap ? {
    latitude: (resultData.userCoords.latitude + resultData.landmarkCoords.latitude) / 2,
    longitude: (resultData.userCoords.longitude + resultData.landmarkCoords.longitude) / 2,
    latitudeDelta: Math.abs(resultData.userCoords.latitude - resultData.landmarkCoords.latitude) * 1.5 + 0.02, // Adjust zoom based on distance
    longitudeDelta: Math.abs(resultData.userCoords.longitude - resultData.landmarkCoords.longitude) * 1.5 + 0.02,
  } : { // Default fallback region (e.g., center of Lahore or world)
    latitude: 31.5497, // Lahore approx center
    longitude: 74.3436,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  useEffect(() => {
    // Animate map to fit markers once map is ready and if we have coords
    if (mapReady && canShowMap && mapRef.current) {
      // Give layout calculation a moment
      setTimeout(() => {
        mapRef.current.fitToCoordinates(
          [resultData.userCoords, resultData.landmarkCoords, ...Object.values(mock_landmarks)],
          {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
      }, 200);
    }
    console.log(resultData)
  }, [mapReady, canShowMap, resultData]);

  if (!resultData) {
    // Handle case where data might be missing (shouldn't normally happen)
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: Result data missing.</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#928DAB', '#1F1C2C']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.duration(600)}>
          <Image source={{ uri: resultData.processed_image }} style={styles.image} />
        </Animated.View>

        <Animated.View style={styles.infoBox} entering={SlideInDown.delay(200).duration(500)}>
          <Text style={styles.landmarkTitle}>{resultData.landmark || 'Landmark Not Found'}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Distance:</Text>
            <Text style={styles.infoValue}>{resultData.distance || 'N/A'}</Text>
          </View>
          {/* Add more info rows if needed */}

          {/* Map Section */}
          <Text style={styles.mapTitle}>Location Overview</Text>
          {canShowMap ? (
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE} // Use Google Maps
                initialRegion={initialRegion}
                onMapReady={() => setMapReady(true)} // Mark map as ready
                mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }} // Prevent default Google logo padding issues
              >
                {/* User Marker */}
                {hasUserCoords && (
                  <Marker
                    coordinate={resultData.userCoords}
                    title="Your Location"
                    pinColor="blue" // Or use a custom image
                  />
                )}
                {/* Landmark Marker */}
                {hasLandmarkCoords && (
                  <Marker
                    coordinate={resultData.landmarkCoords}
                    title={resultData.landmark}
                    pinColor="red" // Or use a custom image
                  />
                )}
                {/* Additional Landmarks */}
                {Object.entries(mock_landmarks).map(([key, coords]) => (
                  <Marker
                    key={key}
                    coordinate={coords}
                    title={key}
                    pinColor="green" // Or use a custom image
                  />
                ))}
              </MapView>
              {!mapReady && <ActivityIndicator style={StyleSheet.absoluteFill} size="large" />}
            </View>
          ) : (
            <Text style={styles.mapPlaceholder}>Map cannot be displayed. Location data missing for user or landmark.</Text>
          )}
        </Animated.View>
      </ScrollView>
      {/* Simple Back Button - Positioned absolutely */}
      <Animated.View style={styles.backButtonContainer} entering={FadeIn.delay(800)}>
        <Text style={styles.backButton} onPress={() => navigation.goBack()}>&lt; Go Back</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 80, // Space for back button or other elements
  },
  image: {
    width: width, // Full width
    height: height * 0.4, // 40% of screen height
    resizeMode: 'cover',
    marginBottom: 0, // No margin below image
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Semi-transparent white
    borderRadius: 20,
    padding: 25,
    width: width * 0.9, // 90% of screen width
    marginTop: -40, // Overlap the image slightly
    alignItems: 'center',
    // Add shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  landmarkTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 10, // Add some padding inside the row
  },
  infoLabel: {
    fontSize: 16,
    color: '#E0E0E0',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 25,
    marginBottom: 15,
  },
  mapContainer: {
    width: '100%',
    height: 250, // Fixed height for the map view
    borderRadius: 15,
    overflow: 'hidden', // Clip the map to the border radius
    backgroundColor: '#555', // Placeholder background while map loads
  },
  map: {
    ...StyleSheet.absoluteFillObject, // Make map fill the container
  },
  mapPlaceholder: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  backButtonContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40, // Adjust for status bar
    left: 20,
    zIndex: 10, // Ensure it's above other content
  },
  backButton: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
  },
});
