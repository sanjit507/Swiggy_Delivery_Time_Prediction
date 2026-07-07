const form = document.getElementById('prediction-form');
const predictionValue = document.getElementById('prediction-value');
const resultCopy = document.getElementById('result-copy');
const statusPill = document.getElementById('status-pill');
const messageBox = document.getElementById('form-message');
const loadSampleButton = document.getElementById('load-sample');
const trackingUriEl = document.getElementById('tracking-uri');
const toggleAdvancedButton = document.getElementById('toggle-advanced');
const advancedFields = document.getElementById('advanced-fields');
const distanceInput = document.getElementById('simple-distance');
const resultValue = document.getElementById('result-value');

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

const updateCoordinatesFromDistance = () => {
  const distance = parseFloat(distanceInput.value) || 5.0;
  const restLatEl = form.elements.namedItem('Restaurant_latitude');
  const restLonEl = form.elements.namedItem('Restaurant_longitude');
  const delLatEl = form.elements.namedItem('Delivery_location_latitude');
  const delLonEl = form.elements.namedItem('Delivery_location_longitude');
  
  if (restLatEl && restLonEl && delLatEl && delLonEl) {
    const restLat = parseFloat(restLatEl.value) || 12.9716;
    const restLon = parseFloat(restLonEl.value) || 77.5946;
    delLatEl.value = restLat;
    // 1 degree longitude is approx 108.48 km at 12.97 latitude
    delLonEl.value = (restLon + (distance / 108.48)).toFixed(4);
  }
};

const initDefaults = () => {
  // Generate random Order ID if empty
  const orderIdEl = form.elements.namedItem('ID');
  if (orderIdEl) {
    orderIdEl.value = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  }
  
  // Generate random Rider ID if empty
  const riderIdEl = form.elements.namedItem('Delivery_person_ID');
  if (riderIdEl) {
    riderIdEl.value = 'RIDER-' + Math.floor(10 + Math.random() * 90);
  }
  
  // Set current date
  const dateEl = form.elements.namedItem('Order_Date');
  if (dateEl) {
    dateEl.value = new Date().toISOString().split('T')[0];
  }
  
  // Set current time and picked time
  const timeOrderedEl = form.elements.namedItem('Time_Orderd');
  const timePickedEl = form.elements.namedItem('Time_Order_picked');
  const now = new Date();
  const formatTime = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  
  if (timeOrderedEl) {
    timeOrderedEl.value = formatTime(now);
  }
  if (timePickedEl) {
    const pickedTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes later
    timePickedEl.value = formatTime(pickedTime);
  }
  
  // Coordinates
  const restLatEl = form.elements.namedItem('Restaurant_latitude');
  const restLonEl = form.elements.namedItem('Restaurant_longitude');
  const delLatEl = form.elements.namedItem('Delivery_location_latitude');
  
  if (restLatEl) restLatEl.value = '12.9716';
  if (restLonEl) restLonEl.value = '77.5946';
  if (delLatEl) delLatEl.value = '12.9716';
  
  updateCoordinatesFromDistance();
};

const getFormData = () => {
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());

  // Clean out any UI-only helper fields that are not in the schema
  delete payload['simple-distance'];

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
  // 5.3 km matches the difference in sample coordinates
  distanceInput.value = "5.3";
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

// Event Listeners
distanceInput.addEventListener('input', updateCoordinatesFromDistance);

toggleAdvancedButton.addEventListener('click', () => {
  const isHidden = advancedFields.classList.toggle('hidden');
  toggleAdvancedButton.textContent = isHidden ? 'Show Advanced' : 'Hide Advanced';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();
  setStatus('Predicting...', 'neutral');
  predictionValue.textContent = '...';

  // Ensure coordinates match current distance selection
  updateCoordinatesFromDistance();

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
    resultValue.textContent = `${value} min`;
    resultCopy.textContent = 'The model returned a delivery-time estimate based on the current input.';
    setStatus('Prediction ready', 'success');
    showMessage('Prediction completed successfully.', 'success');
  } catch (error) {
    predictionValue.textContent = 'Error';
    resultValue.textContent = 'Error';
    resultCopy.textContent = error.message;
    setStatus('Prediction failed', 'error');
    showMessage(error.message, 'error');
  }
});

loadSampleButton.addEventListener('click', fillSample);

form.addEventListener('reset', () => {
  setTimeout(() => {
    predictionValue.textContent = '--';
    resultValue.textContent = '--';
    resultCopy.textContent = 'Submit the form to see the model output here.';
    setStatus('Waiting for input', 'neutral');
    hideMessage();
    initDefaults();
  }, 10);
});

// Initialize defaults and model info on start
initDefaults();
fetchModelInfo();