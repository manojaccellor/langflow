# src/backend/base/langflow/utils/deploy.py
import os
import shutil
import zipfile
import contextlib
import re
from jinja2 import Environment, FileSystemLoader
from langflow.graph.graph.base import Graph
from langflow.services.database.models.flow import Flow


def generate_fastapi_app(flow: Flow, output_dir: str) -> str:
    """Generate a FastAPI application from a flow.

    Args:
        flow (Flow): The flow to generate an application from
        output_dir (str): The directory to output the application to

    Returns:
        str: The path to the generated application
    """
    app_dir = os.path.join(output_dir, f"{flow.name}_fastapi_app")
    os.makedirs(app_dir, exist_ok=True)

    # Create the application structure
    os.makedirs(os.path.join(app_dir, "app"), exist_ok=True)

    # Create a Graph object from the flow data
    graph = Graph.from_payload(flow.data)

    # Generate the application files using templates
    env = Environment(loader=FileSystemLoader("templates/fastapi_app"))

    # Generate main.py
    main_template = env.get_template("main.py.jinja2")
    with open(os.path.join(app_dir, "app", "main.py"), "w") as f:
        f.write(
            main_template.render(
                flow_name=flow.name, flow_id=flow.id, flow_description=flow.description or "A Langflow application"
            )
        )

    # Generate flow.py with the flow definition
    flow_template = env.get_template("flow.py.jinja2")
    with open(os.path.join(app_dir, "app", "flow.py"), "w") as f:
        f.write(flow_template.render(flow_data=flow.data))

    # Generate requirements.txt
    requirements_template = env.get_template("requirements.txt.jinja2")
    with open(os.path.join(app_dir, "requirements.txt"), "w") as f:
        f.write(requirements_template.render())

    # Generate README.md
    readme_template = env.get_template("README.md.jinja2")
    with open(os.path.join(app_dir, "README.md"), "w") as f:
        f.write(
            readme_template.render(flow_name=flow.name, flow_description=flow.description or "A Langflow application")
        )

    # Generate Dockerfile
    dockerfile_template = env.get_template("Dockerfile.jinja2")
    with open(os.path.join(app_dir, "Dockerfile"), "w") as f:
        f.write(dockerfile_template.render())

    return app_dir


def create_zip_file(app_dir: str) -> str:
    """Create a zip file of the application.

    Args:
        app_dir (str): The directory containing the application

    Returns:
        str: The path to the created zip file
    """
    zip_path = f"{app_dir}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(app_dir):
            for file in files:
                file_path = os.path.join(root, file)
                zipf.write(file_path, os.path.relpath(file_path, os.path.dirname(app_dir)))

    return zip_path
