import tensorflow as tf
from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
from PIL import Image
import numpy as np
import io
import cv2 # Keep cv2 import if needed elsewhere, though not used in this snippet directly
import math
from ultralytics import YOLO
import logging
import os # Import os for removing temp file
from flask_cors import CORS


# ---------------- GPU CONFIG ---------------- #
# (Keep your GPU config as is)
physical_devices = tf.config.list_physical_devices('GPU')
if physical_devices:
    try:
        # Restrict TensorFlow to only allocate 4GB of memory on the first GPU
        tf.config.set_logical_device_configuration(
            physical_devices[0],
            [tf.config.LogicalDeviceConfiguration(memory_limit=4096)])
        # Enable memory growth for the GPU
        tf.config.experimental.set_memory_growth(physical_devices[0], True)
        logical_gpus = tf.config.list_logical_devices('GPU')
        print(len(physical_devices), "Physical GPUs,", len(logical_gpus), "Logical GPUs")
    except RuntimeError as e:
        # Virtual devices must be set before GPUs have been initialized
        print(e)
else:
    print("No GPU detected, using CPU.")


# ---------------- FLASK INIT ---------------- #
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------- MODEL LOAD ---------------- #
try:
    logger.info("Loading CNN model...")
    # Ensure the path is correct or use an absolute path if needed
    cnn_model_path = 'CV_CNN1.h5'
    if not os.path.exists(cnn_model_path):
         raise FileNotFoundError(f"CNN model file not found at {cnn_model_path}")
    cnn_model = load_model(cnn_model_path)
    # No need to compile again if the model was saved compiled, unless changing optimizer/loss
    # cnn_model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    logger.info("CNN model loaded successfully.")

    logger.info("Loading YOLO model...")
    yolo_model_path = r'yolo.pt' # Use raw string for Windows paths or ensure correct slashes
    if not os.path.exists(yolo_model_path):
         raise FileNotFoundError(f"YOLO model file not found at {yolo_model_path}")
    yolo_model = YOLO(yolo_model_path)
    logger.info("YOLO model loaded successfully.")

except FileNotFoundError as fnf_error:
    logger.error(f"Model loading error: {fnf_error}")
    # Exit or handle appropriately if models can't load
    exit()
except Exception as e:
    logger.error(f"An unexpected error occurred during model loading: {e}")
    exit()


# ---------------- CLASS NAMES & ACTUAL LANDMARK COORDINATES ---------------- #
# These are the *actual* known locations of the landmarks
class_names = ['Civil', 'CS', 'EE', 'Gate 5', 'Library', 'Main', 'NB', 'Old cafe', 'Wuzu']

actual_landmark_coordinates = {
    'Civil':     {'latitude': 31.481986801343748, 'longitude': 74.30364459192805},
    'CS':        {'latitude': 31.48115970726234,  'longitude': 74.30288450189659},
    'EE':        {'latitude': 31.48106738002753,  'longitude': 74.3033040174629},
    'Gate 5':    {'latitude': 31.48079536833649,  'longitude': 74.30415120439103},
    'Library':   {'latitude': 31.481559513821388, 'longitude': 74.30379489883944},
    'NB':        {'latitude': 31.480306772468865, 'longitude': 74.30395136592784},
    'Old cafe':  {'latitude': 31.481028590362214, 'longitude': 74.30391442211119},
    'Wuzu':      {'latitude': 31.481380587602427, 'longitude': 74.30330995882208},
    'Main':      {'latitude': 31.4816111,          'longitude': 74.3029722},
}



# ---------------- HELPER FUNCTIONS ---------------- #
def preprocess_image(image, target_size=(224, 224)):
    try:
        if image.mode != 'RGB':
            image = image.convert('RGB')
        image = image.resize(target_size)
        image_array = np.asarray(image) / 255.0
        return np.expand_dims(image_array, axis=0)
    except Exception as e:
        logger.error(f"Error during image preprocessing: {e}")
        raise # Re-raise the exception to be caught by the caller

# Removed offset_coordinates function as it's not reliable for user location estimation here

# ---------------- PREDICTION API ---------------- #
@app.route('/predict', methods=['POST'])
def predict():
    logger.info('Received prediction request')
    if 'image' not in request.files:
        logger.error('No image file found in the request')
        return jsonify({'error': 'No image uploaded'}), 400

    image_file = request.files['image']
    if image_file.filename == '':
        logger.error('No image file selected')
        return jsonify({'error': 'No selected file'}), 400

    logger.info(f'Received image file: {image_file.filename}')

    try:
        image = Image.open(image_file.stream)

        # --- CNN Prediction ---
        cnn_image = preprocess_image(image)
        cnn_predictions = cnn_model.predict(cnn_image)
        predicted_class_index = int(np.argmax(cnn_predictions))

        # Ensure index is within bounds
        if predicted_class_index < 0 or predicted_class_index >= len(class_names):
             logger.error(f"Predicted class index {predicted_class_index} is out of bounds for class_names (len: {len(class_names)})")
             return jsonify({'error': 'CNN prediction index out of bounds'}), 500

        predicted_class_name = class_names[predicted_class_index]
        logger.info(f'CNN Prediction: {predicted_class_name} (Index: {predicted_class_index}), Confidence: {cnn_predictions[0][predicted_class_index]:.4f}')

        # Get the actual coordinates of the identified landmark
        landmark_actual_coords = actual_landmark_coordinates.get(predicted_class_name)
        if not landmark_actual_coords:
            logger.warning(f"Actual coordinates not found for predicted landmark: {predicted_class_name}")
            # Decide how to handle this: return error, or proceed without coords?
            # For now, proceed but coords will be null

        # --- YOLO Distance Estimation ---
        # Save image temporarily for YOLO (YOLO might prefer file path)
        temp_image_path = "temp_image_yolo.jpg"
        try:
            image.save(temp_image_path)
            logger.info(f'Image saved temporarily for YOLO at: {temp_image_path}')
            results = yolo_model(temp_image_path) # Perform detection
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_image_path):
                os.remove(temp_image_path)
                logger.info(f'Temporary YOLO image removed: {temp_image_path}')


        # Distance constants - **CRITICAL**: These need calibration!
        # FOCAL_LENGTH_PX is highly dependent on the specific camera/phone used.
        # class_heights_m assumes these YOLO classes ('80', '120', etc.) correspond to these heights.
        # This whole section is a major source of potential inaccuracy.
        FOCAL_LENGTH_PX = 680 # Example value - NEEDS CALIBRATION PER DEVICE
        # Make sure these class names ('80', '120' etc.) are ACTUALLY what your yolo.pt model predicts
        class_heights_m = {
            '80': 0.80,   '120': 1.20,  '140': 1.40, '160': 1.60,
            '200': 2.00,  '210': 2.10,  '220': 2.20, '380': 3.80,
            '650': 8.50 # Assuming '650' corresponds to 8.50 meters? Verify this.
            # Add other classes detected by your specific yolo.pt model here
        }
        logger.info(f"Using Focal Length (px): {FOCAL_LENGTH_PX}")
        logger.info(f"Known object heights (m) for distance calculation: {class_heights_m}")

        distances = []
        yolo_detections = []

        if results:
            for result in results: # Iterate through results list (usually just one image)
                boxes = result.boxes
                if boxes is not None and len(boxes) > 0:
                    logger.info(f"YOLO detected {len(boxes)} objects.")
                    for i in range(len(boxes)):
                        try:
                            cls_id = int(boxes.cls[i])
                            # Ensure yolo_model.names exists and cls_id is a valid index
                            if hasattr(yolo_model, 'names') and cls_id < len(yolo_model.names):
                                yolo_class_name = str(yolo_model.names[cls_id])
                            else:
                                logger.warning(f"Cannot find class name for YOLO cls_id: {cls_id}")
                                yolo_class_name = f"Unknown_{cls_id}"

                            xyxy = boxes.xyxy[i].cpu().numpy() # Get box coordinates
                            x1, y1, x2, y2 = map(int, xyxy)
                            height_px = int(y2 - y1)
                            confidence = float(boxes.conf[i])

                            detection_info = {
                                'class_name': yolo_class_name,
                                'confidence': round(confidence, 3),
                                'box_pixels': [x1, y1, x2, y2],
                                'height_pixels': height_px,
                                'estimated_distance_m': None # Initialize
                            }

                            # Check if we know the real height for this detected class
                            real_height_m = class_heights_m.get(yolo_class_name)

                            if real_height_m:
                                if height_px > 0:
                                    # Calculate distance based on this object
                                    distance_m = (FOCAL_LENGTH_PX * real_height_m) / height_px
                                    distances.append(distance_m)
                                    detection_info['estimated_distance_m'] = round(distance_m, 2)
                                    logger.debug(f"  - Detected '{yolo_class_name}' (h:{height_px}px, conf:{confidence:.2f}) -> Est. Distance: {distance_m:.2f} m (using real height {real_height_m}m)")
                                else:
                                    logger.warning(f"  - Detected '{yolo_class_name}' but pixel height is 0, cannot calculate distance.")
                            else:
                                logger.debug(f"  - Detected '{yolo_class_name}' (h:{height_px}px, conf:{confidence:.2f}) - No known height for distance calculation.")

                            yolo_detections.append(detection_info)

                        except Exception as det_err:
                            logger.error(f"Error processing YOLO detection index {i}: {det_err}")
                else:
                    logger.info("YOLO model returned results, but no bounding boxes were found.")
        else:
            logger.info("YOLO model did not return any results for the image.")


        # Calculate average distance from valid measurements
        avg_distance = round(np.mean(distances), 2) if distances else None
        logger.info(f"Calculated Average Distance from {len(distances)} measurements: {avg_distance} m")

        # --- Prepare final response ---
        response = {
            'cnn_predicted_class_index': predicted_class_index,
            'cnn_predicted_class_name': predicted_class_name,
            'cnn_top_probability': round(float(np.max(cnn_predictions)), 4), # Use float() for JSON compatibility
            'actual_landmark_coordinates': landmark_actual_coords, # Actual coordinates of the identified landmark
            'yolo_estimated_distance_m': avg_distance, # Average distance from YOLO
            'yolo_individual_distances_m': [round(d, 2) for d in distances], # List of individual distances used
            'yolo_detections': yolo_detections, # Detailed info about each YOLO detection
            # 'cnn_class_probabilities': cnn_predictions[0].tolist(), # Optional: Send all probabilities
        }

        logger.info(f'Sending response: {response}')
        return jsonify(response)

    except FileNotFoundError as e:
         logger.error(f"File processing error: {e}")
         return jsonify({'error': f'Server error: {e}'}), 500
    except tf.errors.OpError as e:
        logger.error(f"TensorFlow runtime error during prediction: {e}")
        return jsonify({'error': 'Model prediction failed'}), 500
    except ImportError as e:
        logger.error(f"Import error, check dependencies: {e}")
        return jsonify({'error': f'Server dependency error: {e}'}), 500
    except Exception as e:
        logger.error(f'An unexpected error occurred in /predict: {e}', exc_info=True) # Log traceback
        return jsonify({'error': 'An internal server error occurred'}), 500

# ---------------- HEALTH CHECK ---------------- #
@app.route('/health', methods=['GET'])
def health_check():
    logger.info('Received health check request')
    # Optionally add checks here (e.g., model loaded flags)
    return jsonify({'status': 'Server is running'}), 200

# ---------------- RUN APP ---------------- #
if __name__ == '__main__':
    logger.info('Starting Flask app...')
    # Use port 5001 as specified in RN code, disable debug for production
    # Host '0.0.0.0' makes it accessible on the network
    app.run(debug=False, host='0.0.0.0', port=5001)