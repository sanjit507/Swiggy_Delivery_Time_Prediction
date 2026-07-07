const form = document.getElementById('prediction-form');
const predictionValue = document.getElementById('prediction-value');
const resultCopy = document.getElementById('result-copy');
const statusPill = document.getElementById('status-pill');
const messageBox = document.getElementById('form-message');
const loadSampleButton = document.getElementById('load-sample');
const trackingUriEl = document.getElementById('tracking-uri');

const samplePayload = {
  ID: 'ORD-2048',
  Delivery_person_ID: 'RIDER-44',
  Delivery_person_Age: 29,
  Delivery_person_Ratings: 4.7,
  Restaurant_latitude: 12.9716,
  Restaurant_longitude: 77.5946,
  Delivery_location_latitude: 12.9352,
  Delivery_location_longitude: 77.6245,
  Order_Date: '2026-07-07',
  Time_Orderd: '12:15',
  Time_Order_picked: '12:24',
  Weatherconditions: 'conditions cloudy',
  Road_traffic_density: 'medium',
  Vehicle_condition: 2,
  Type_of_order: 'meal',
  Type_of_vehicle: 'scooter',
  multiple_deliveries: 0,
  Festival: 'no',
  City: 'urban',
};

const setStatus = (text, kind = 'neutral') => {
  statusPill.textContent = text;
  statusPill.className = `pill ${kind}`;
};

const showMessage = (text, kind = 'success') => {
  messageBox.textContent = text;
  messageBox.className = `message ${kind}`;
};

const hideMessage = () => {
  messageBox.textContent = '';
  messageBox.className = 'message hidden';
};

const getFormData = () => {
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());

  ['Delivery_person_Age', 'Delivery_person_Ratings', 'Restaurant_latitude', 'Restaurant_longitude', 'Delivery_location_latitude', 'Delivery_location_longitude', 'Vehicle_condition', 'multiple_deliveries'].forEach((field) => {
    payload[field] = Number(payload[field]);
  });

  return payload;
};

const fillSample = () => {
  Object.entries(samplePayload).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });
  hideMessage();
  setStatus('Sample loaded', 'neutral');
};

const fetchModelInfo = async () => {
  try {
    const response = await fetch('/api/model-info');
    if (!response.ok) return;
    const info = await response.json();
    trackingUriEl.textContent = info.tracking_uri || 'local';
  } catch (error) {
    trackingUriEl.textContent = 'Unavailable';
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();
  setStatus('Predicting...', 'neutral');
  predictionValue.textContent = '...';

  const payload = getFormData();

  try {
    const response = await fetch('/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Prediction request failed');
    }

    const result = await response.json();
    const value = Number(result.prediction_minutes).toFixed(2);

    predictionValue.textContent = `${value} min`;
    resultCopy.textContent = 'The model returned a delivery-time estimate based on the current input.';
    setStatus('Prediction ready', 'success');
    showMessage('Prediction completed successfully.', 'success');
  } catch (error) {
    predictionValue.textContent = 'Error';
    resultCopy.textContent = error.message;
    setStatus('Prediction failed', 'error');
    showMessage(error.message, 'error');
  }
});

loadSampleButton.addEventListener('click', fillSample);
form.addEventListener('reset', () => {
  predictionValue.textContent = '--';
  resultCopy.textContent = 'Submit the form to see the model output here.';
  setStatus('Waiting for input', 'neutral');
  hideMessage();
});

fetchModelInfo();