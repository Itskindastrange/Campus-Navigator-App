import * as ImageManipulator from 'expo-image-manipulator';

// Replace with your actual Flask server IP address and port
const API_URL = 'http://192.168.18.117:5001'; // YOUR SERVER ADDRESS
//http://192.168.137.1:5001
// Earth radius in meters
const EARTH_RADIUS = 6371000;

// Utility function to calculate destination point based on distance and bearing
function calculateOffsetCoordinates(lat, lon, distance, bearingDegrees) {
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const distRatio = distance / EARTH_RADIUS;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distRatio) +
      Math.cos(lat1) * Math.sin(distRatio) * Math.cos(bearing)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distRatio) * Math.cos(lat1),
      Math.cos(distRatio) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (lon2 * 180) / Math.PI,
  };
}

export const processImage = async (imageUri, userLocation) => {
  console.log('Processing image with API:', imageUri);
  console.log('User location provided:', userLocation ? JSON.stringify(userLocation.coords) : 'Not available');

  try {
    // 1. Compress the image
    console.log('Compressing image...');
    const compressedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    console.log('Image compressed:', compressedImage.uri);

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append('image', {
      uri: compressedImage.uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });

    // 3. Optional: Health Check
    try {
      console.log(`Checking server health at ${API_URL}/health...`);
      const healthRes = await fetch(`${API_URL}/health`);
      if (!healthRes.ok) {
        console.warn(`Health check failed with status: ${healthRes.status}`);
      } else {
        const healthData = await healthRes.json();
        console.log('Server health:', healthData);
      }
    } catch (healthError) {
      console.error('Health check request failed:', healthError);
    }

    // 4. Call the prediction API
    console.log(`Sending image to prediction API: ${API_URL}/predict`);
    const response = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
      body: formData,
    });

    console.log('API raw response status:', response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error Response:', data);
      throw new Error(data?.error || `API request failed with status ${response.status}`);
    }

    console.log('API Success Response:', data);

    // Extract and format data
    const detectedLandmarkName = data.cnn_predicted_class_name || 'Unknown Landmark';
    const actualLandmarkCoords = data.actual_landmark_coordinates;
    const estimatedDistanceM = data.yolo_estimated_distance_m;

    let distanceString = 'N/A';
    if (estimatedDistanceM != null) {
      distanceString = estimatedDistanceM >= 1000
        ? `${(estimatedDistanceM / 1000).toFixed(2)} km`
        : `${estimatedDistanceM.toFixed(2)} m`;
    }

    // FIXED: Always calculate estimated user coordinates based on the landmark and distance
    let estimatedUserCoords = null;
    if (actualLandmarkCoords && estimatedDistanceM != null) {
      // We use a default bearing of 180° (south of the landmark)
      // In a real app, you might want to use compass heading if available
      const defaultBearing = 180;
      estimatedUserCoords = calculateOffsetCoordinates(
        actualLandmarkCoords.latitude,
        actualLandmarkCoords.longitude,
        estimatedDistanceM,
        defaultBearing
      );
      console.log('Estimated user coordinates based on landmark and distance:', estimatedUserCoords);
    } else if (userLocation?.coords) {
      // Fallback to device location if we can't calculate from landmark
      estimatedUserCoords = userLocation.coords;
      console.log('Using device location as fallback:', estimatedUserCoords);
    }

    // Final response
    return {
      success: true,
      data: {
        processed_image: compressedImage.uri,
        landmark: detectedLandmarkName,
        distance: distanceString,
        landmarkCoords: actualLandmarkCoords,
        userCoords: estimatedUserCoords,
      },
    };

  } catch (error) {
    console.error('Error in processImage function:', error);
    return {
      success: false,
      error: error.message || 'An unknown error occurred during image processing.',
      data: {
        processed_image: imageUri,
        landmark: 'Error',
        distance: 'Error',
        landmarkCoords: null,
        userCoords: userLocation?.coords || null,
      },
    };
  }
};