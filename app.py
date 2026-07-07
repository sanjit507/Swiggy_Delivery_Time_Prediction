from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sklearn.pipeline import Pipeline
import uvicorn
import pandas as pd
import mlflow
import json
import joblib
import os
from pathlib import Path
from mlflow import MlflowClient
from sklearn import set_config
from scripts.data_clean_utils import perform_data_cleaning

# set the output as pandas
set_config(transform_output='pandas')

import mlflow.client

BASE_DIR = Path(__file__).resolve().parent


# set the mlflow tracking server
mlflow_db_path = (BASE_DIR / "mlflow.db").resolve().as_posix()
tracking_uri = os.getenv("MLFLOW_TRACKING_URI")
if not tracking_uri:
    tracking_uri = f"sqlite:///{mlflow_db_path}"
mlflow.set_tracking_uri(tracking_uri)


class Data(BaseModel):  
    ID: str
    Delivery_person_ID: str
    Delivery_person_Age: int
    Delivery_person_Ratings: float
    Restaurant_latitude: float
    Restaurant_longitude: float
    Delivery_location_latitude: float
    Delivery_location_longitude: float
    Order_Date: str
    Time_Orderd: str
    Time_Order_picked: str
    Weatherconditions: str
    Road_traffic_density: str
    Vehicle_condition: int
    Type_of_order: str
    Type_of_vehicle: str
    multiple_deliveries: int
    Festival: str
    City: str


    
    
def load_model_information(file_path):
    with open(file_path) as f:
        run_info = json.load(f)
        
    return run_info


def load_transformer(transformer_path):
    transformer = joblib.load(transformer_path)
    return transformer



# columns to preprocess in data
num_cols = ["age",
            "ratings",
            "pickup_time_minutes",
            "distance"]

nominal_cat_cols = ['weather',
                    'type_of_order',
                    'type_of_vehicle',
                    "festival",
                    "city_type",
                    "is_weekend",
                    "order_time_of_day"]

ordinal_cat_cols = ["traffic","distance_type"]

#mlflow client
client = MlflowClient()

# load the model info to get the model name
model_name = load_model_information(BASE_DIR / "run_information.json")['model_name']

# stage of the model
stage = "Staging"

# get the latest model version
# latest_model_ver = client.get_latest_versions(name=model_name,stages=[stage])
# print(f"Latest model in production is version {latest_model_ver[0].version}")

# load model path
model_path = f"models:/{model_name}/{stage}"

# load the latest model from model registry
model = mlflow.sklearn.load_model(model_path)
print("Model loaded successfully from DagsHub. Server is starting...")

# load the preprocessor
preprocessor_path = "models/preprocessor.joblib"
preprocessor = load_transformer(preprocessor_path)

# build the model pipeline
model_pipe = Pipeline(steps=[
    ('preprocess',preprocessor),
    ("regressor",model)
])

# create the app
app = FastAPI(title="Swiggy Delivery Time Prediction")

# Mount static files
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Templates setup
templates_dir = BASE_DIR / "templates"
templates = Jinja2Templates(directory=str(templates_dir)) if templates_dir.exists() else None


# create the home endpoint
@app.get(path="/")
def home(request: Request):
    if templates is None:
        return {"model_name": model_name, "stage": stage}
    return templates.TemplateResponse(request, "home.html", {
        "model_name": model_name,
        "stage": stage
    })


@app.get(path="/api/model-info")
def model_info():
    return {
        "model_name": model_name,
        "stage": stage,
        "tracking_uri": tracking_uri,
    }

# create the predict endpoint
@app.post(path="/predict")
def do_predictions(data: Data):
    try:
        pred_data = pd.DataFrame(
            {
                'ID': data.ID,
                'Delivery_person_ID': data.Delivery_person_ID,
                'Delivery_person_Age': data.Delivery_person_Age,
                'Delivery_person_Ratings': data.Delivery_person_Ratings,
                'Restaurant_latitude': data.Restaurant_latitude,
                'Restaurant_longitude': data.Restaurant_longitude,
                'Delivery_location_latitude': data.Delivery_location_latitude,
                'Delivery_location_longitude': data.Delivery_location_longitude,
                'Order_Date': data.Order_Date,
                'Time_Orderd': data.Time_Orderd,
                'Time_Order_picked': data.Time_Order_picked,
                'Weatherconditions': data.Weatherconditions,
                'Road_traffic_density': data.Road_traffic_density,
                'Vehicle_condition': data.Vehicle_condition,
                'Type_of_order': data.Type_of_order,
                'Type_of_vehicle': data.Type_of_vehicle,
                'multiple_deliveries': data.multiple_deliveries,
                'Festival': data.Festival,
                'City': data.City,
            },
            index=[0]
        )

        # clean the raw input data
        cleaned_data = perform_data_cleaning(pred_data)
        if cleaned_data.empty:
            raise ValueError("Input data could not be cleaned into a valid prediction row")

        # get the predictions
        predictions = model_pipe.predict(cleaned_data)[0]
        return {"prediction_minutes": float(predictions)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
   
   
if __name__ == "__main__":
    uvicorn.run(app="app:app",host="0.0.0.0",port=8000)