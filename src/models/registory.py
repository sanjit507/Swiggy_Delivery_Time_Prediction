import json
import os
from pathlib import Path
from mlflow import MlflowClient
import logging

try:
    import mlflow
except ImportError:
    mlflow = None


# create logger
logger = logging.getLogger("register_model")
logger.setLevel(logging.INFO)

# console handler
handler = logging.StreamHandler()
handler.setLevel(logging.INFO)

# add handler to logger
logger.addHandler(handler)

# create a fomratter
formatter = logging.Formatter(fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# add formatter to handler
handler.setFormatter(formatter)

if mlflow is not None:
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI")
    if tracking_uri:
        # set the mlflow tracking server
        mlflow.set_tracking_uri(tracking_uri)


def load_model_information(file_path):
    with open(file_path) as f:
        run_info = json.load(f)
        
    return run_info


if __name__ == "__main__":
    # root path
    root_path = Path(__file__).parent.parent.parent

    if mlflow is None:
        raise RuntimeError("mlflow is not installed in the active Python environment")

    if not os.getenv("MLFLOW_TRACKING_URI"):
        mlflow_db_path = (root_path / "mlflow.db").resolve()
        mlflow.set_tracking_uri(f"sqlite:///{mlflow_db_path.as_posix()}")
    
    # run information file path
    run_info_path = root_path / "run_information.json"
    
    # register the model
    run_info = load_model_information(run_info_path)
    
    # get the run id
    run_id = run_info["run_id"]
    model_name = run_info["model_name"]

    if not run_id:
        raise ValueError("run_information.json does not contain a valid run_id. Run evaluation again with MLflow tracking enabled.")
    
    # model to register path
    model_registry_path = f"runs:/{run_id}/{model_name}"
    
    
    # register the model
    model_version = mlflow.register_model(model_uri=model_registry_path,
                                          name=model_name)
    
    
    # get the model version
    registered_model_version = model_version.version
    registered_model_name = model_version.name
    logger.info(f"The latest model version in model registry is {registered_model_version}")
    
    # update the stage of the model to staging
    client = MlflowClient()
    client.transition_model_version_stage(
        name=registered_model_name,
        version=registered_model_version,
        stage="Staging"
    )
    
    logger.info("Model pushed to Staging stage")
    