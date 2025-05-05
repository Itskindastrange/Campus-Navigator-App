import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.models import load_model
from PIL import Image
import numpy as np
import io
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load your CNN model
model = load_model('CV_CNN1.h5')

# Compile the model if not done already
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

# Preprocess function (edit based on your model input)
def preprocess_image(image, target_size=(224, 224)):
    if image.mode != 'RGB':
        image = image.convert('RGB')
    image = image.resize(target_size)
    image_array = np.asarray(image) / 255.0
    image_array = np.expand_dims(image_array, axis=0)
    return image_array

# API endpoint for prediction
@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    image_file = request.files['image']
    image = Image.open(image_file.stream)
    processed_image = preprocess_image(image)

    # Predict using CNN
    predictions = model.predict(processed_image)
    predicted_class = int(np.argmax(predictions))

    return jsonify({
        'predicted_class': predicted_class,
        'class_probabilities': predictions[0].tolist(),
    })

# API endpoint for health check
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'Server is running'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
