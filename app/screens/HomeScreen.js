// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import AnimatedButton from '../components/AnimatedButton'; // Import the animated button
import { processImage } from '../api/mockApi'; // Import the mock API function

// Optional: Add a logo or fun graphic
const logo = require('../assets/logo.jpg'); // Update the path to the actual logo image

export default function HomeScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  // Request Location Permissions on Mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to calculate distance accurately.');
        return;
      }
      // Optionally get initial location here, or wait until image selection
      // let location = await Location.getCurrentPositionAsync({});
      // setUserLocation(location);
    })();
  }, []);


  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
        const cameraRollStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraRollStatus.status !== 'granted' || cameraStatus.status !== 'granted') {
            Alert.alert('Permissions Required', 'Camera and Photo Library permissions are needed to select or take pictures.');
            return false;
        }
    }
     // Check location permission again before use
     let { status: locationStatus } = await Location.getForegroundPermissionsAsync();
     if (locationStatus !== 'granted') {
       locationStatus = (await Location.requestForegroundPermissionsAsync()).status;
     }
     if (locationStatus !== 'granted') {
       Alert.alert('Permission Denied', 'Location permission is needed to calculate distance accurately.');
       return false; // Indicate permission failure
     }

    return true;
  };

  const handleImageAction = async (action) => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;


    let result;
    try {
        if (action === 'take') {
            result = await ImagePicker.launchCameraAsync({
                allowsEditing: true, // Optional: Allow editing
                quality: 0.7,        // Reduce quality slightly
            });
        } else { // 'upload'
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.7,
            });
        }

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const imageUri = result.assets[0].uri;
            await analyzeImage(imageUri); // Start analysis
        }
    } catch (error) {
         console.error("Image Picker Error: ", error);
         Alert.alert('Error', 'Could not access camera or library.');
         setIsLoading(false);
         setStatusMessage('');
    }
  };

  const analyzeImage = async (imageUri) => {
      setIsLoading(true);
      setStatusMessage('Finding your location...');

      let location = null;
      try {
          location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLocation(location); // Store it
           setStatusMessage('Analyzing image...');
          console.log("Current Location:", location);

           // Call the mock API
          const apiResponse = await processImage(imageUri, location);

          if (apiResponse.success) {
            navigation.navigate('Result', { resultData: apiResponse.data });
          } else {
             Alert.alert('Analysis Failed', apiResponse.error || 'Could not process the image.');
          }

      } catch (error) {
          console.error("Error getting location or processing image:", error);
          Alert.alert('Error', 'Could not get location or process image. Please ensure location services are enabled.');
      } finally {
         setIsLoading(false);
         setStatusMessage('');
      }
  };

  return (
    <LinearGradient
      colors={['#1F1C2C', '#928DAB']} // Darker, sophisticated gradient
      style={styles.container}
    >
      <Animated.View style={styles.content} entering={FadeIn.duration(800)}>
        {/* Add the logo */}
        <Image source={logo} style={styles.logo} />
        
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[styles.title, { textAlign: 'center' }]}>FAST LHR Campus Navigator</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Animated.Text entering={FadeIn} exiting={FadeOut} style={styles.statusText}>{statusMessage}</Animated.Text>
          </View>
        ) : (
          <Animated.View style={styles.buttonContainer} entering={FadeIn.delay(300)}>
            <AnimatedButton
                title="Take Picture"
                onPress={() => handleImageAction('take')}
                gradientColors={['#6DD5FA', '#2980B9']} // Cool blue gradient
            />
            <AnimatedButton
                title="Upload Image"
                onPress={() => handleImageAction('upload')}
                gradientColors={['#FFC371', '#FF5F6D']} // Warm orange/red gradient
                style={{ marginTop: 15 }} // Add some space
            />
          </Animated.View>
        )}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginTop: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 3,
  },
  buttonContainer: {
    width: '80%',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  statusText: {
    marginTop: 15,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
