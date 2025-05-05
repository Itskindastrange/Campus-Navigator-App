import tensorflow as tf
from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
from PIL import Image
import numpy as np
import io
import cv2
from ultralytics import YOLO

# Limit GPU memory usage for TensorFlow
physical_devices = tf.config.list_physical_devices('GPU')
for device in physical_devices:
    tf.config.experimental.set_memory_growth(device, True)  # Enable memory growth
    tf.config.set_logical_device_configuration(
        device,
        [tf.config.LogicalDeviceConfiguration(memory_limit=4096)]  # Limit memory to 4GB (adjust as needed)
    )

# Initialize Flask app
app = Flask(__name__)

# Load your CNN model (DenseNetV6)
cnn_model = load_model('CV_CNN1.h5')
cnn_model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

# Load the YOLO model
yolo_model_path = r'yolo.pt'
yolo_model = YOLO(yolo_model_path)

# Preprocess function for CNN (edit based on your model input)
def preprocess_image(image, target_size=(224, 224)):
    if image.mode != 'RGB':
        image = image.convert('RGB')
    image = image.resize(target_size)
    image_array = np.asarray(image) / 255.0
    image_array = np.expand_dims(image_array, axis=0)
    return image_array

# Preprocess function for YOLO
def preprocess_yolo_image(image_path):
    return cv2.imread(image_path)

# API endpoint for prediction
@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    image_file = request.files['image']
    image = Image.open(image_file.stream)

    # For CNN prediction
    cnn_image = preprocess_image(image)
    cnn_predictions = cnn_model.predict(cnn_image)
    predicted_class = int(np.argmax(cnn_predictions))

    # For YOLO prediction
    image_path = "temp_image.jpg"  # Temporary file to save the image for YOLO
    image.save(image_path)

    results = yolo_model(image_path)  # Perform YOLO inference

    distances = []  # Store distance calculations for each detected object

    # Constants for distance calculation
    FOCAL_LENGTH_PX = 680  # Example: for iPhone 12 Pro Max
    class_heights_m = {
        '80': 0.80,
        '120': 1.20,
        '140': 1.40,
        '160': 1.60,
        '200': 2.00,
        '210': 2.10,
        '220': 2.20,
        '380': 3.80,
        '650': 8.50
    }

    # Process the YOLO detections
    for result in results:
        boxes = result.boxes
        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i])
            class_name = str(yolo_model.names[cls_id])  # Class name like '120'
            
            xyxy = boxes.xyxy[i].cpu().numpy()
            x1, y1, x2, y2 = map(int, xyxy)
            height_px = int(y2 - y1)
            
            real_height_m = class_heights_m.get(class_name)
            if real_height_m is not None and height_px > 0:
                distance_m = (FOCAL_LENGTH_PX * real_height_m) / height_px
                distances.append(distance_m)

    # Prepare response
    response = {
        'cnn_predicted_class': predicted_class,
        'cnn_class_probabilities': cnn_predictions[0].tolist(),
        'yolo_detected_distances': distances
    }

    return jsonify(response)

# API endpoint for health check (optional, to check if the server is running)
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'Server is running'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5001)
