# CV Project

A React Native mobile application with a Flask backend for computer vision tasks.

## Project Structure

- `app/`: React Native mobile application
- `backend/`: Flask backend with TensorFlow model

## Setup Instructions

### Backend Setup
1. Navigate to the backend directory
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Unix/MacOS: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Run the server: `python app.py`

### Mobile App Setup
1. Navigate to the app directory
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
4. Run on Android: `npm run android`

## Deployment

The backend is configured for deployment on Render. See `backend/render.yaml` for configuration details.

## API Endpoints

- `POST /predict`: Accepts an image file and returns prediction results
- `GET /health`: Health check endpoint 