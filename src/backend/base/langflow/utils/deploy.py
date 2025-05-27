# src/backend/base/langflow/utils/deploy.py
import os
import shutil
import zipfile
import contextlib
import re
import subprocess
import tempfile
from typing import Dict, Tuple
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
    graph = Graph.from_payload(flow.data if flow.data is not None else {})

    # Get the templates directory path
    templates_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates", "fastapi_app")
    print(f"Templates directory path: {templates_dir}")
    
    # Check if templates directory exists
    templates_exist = os.path.exists(templates_dir)
    if not templates_exist:
        # Try alternative paths
        alt_templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "templates", "fastapi_app")
        print(f"Alternative templates directory path: {alt_templates_dir}")
        if os.path.exists(alt_templates_dir):
            templates_dir = alt_templates_dir
            templates_exist = True
        else:
            # Try to find the templates directory in the current working directory
            cwd_templates_dir = os.path.join(os.getcwd(), "langflow", "src", "backend", "base", "langflow", "templates", "fastapi_app")
            print(f"CWD templates directory path: {cwd_templates_dir}")
            if os.path.exists(cwd_templates_dir):
                templates_dir = cwd_templates_dir
                templates_exist = True
    
    # If templates directory doesn't exist, create templates in-memory
    if not templates_exist:
        print("Templates directory not found. Creating templates in-memory.")
        # Create in-memory templates
        templates = {
            "main.py.jinja2": """
\"\"\"
{{ flow_name }} FastAPI Application
Generated from Langflow
\"\"\"

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import json
import time
import uvicorn
from typing import Dict, Any, Optional

from app.flow import load_flow_from_json

# Initialize FastAPI app
app = FastAPI(
    title="{{ flow_name }}",
    description="{{ flow_description }}",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the flow
flow_graph = load_flow_from_json()

# Store active sessions
sessions = {}

@app.get("/")
async def root():
    \"\"\"Root endpoint that returns basic information about the API.\"\"\"
    return {
        "name": "{{ flow_name }}",
        "description": "{{ flow_description }}",
        "endpoints": [
            {"path": "/", "method": "GET", "description": "This information"},
            {"path": "/run", "method": "POST", "description": "Run the flow with input"},
            {"path": "/stream", "method": "POST", "description": "Run the flow with streaming response"},
            {"path": "/health", "method": "GET", "description": "Health check endpoint"}
        ]
    }

@app.get("/health")
async def health_check():
    \"\"\"Health check endpoint.\"\"\"
    return {"status": "ok"}

@app.post("/run")
async def run_flow(request: Request):
    \"\"\"Run the flow with the provided input.\"\"\"
    try:
        # Parse the request body
        body = await request.json()
        
        # Extract input from request
        input_value = body.get("input", "")
        input_type = body.get("input_type", "text")
        session_id = body.get("session_id")
        
        # Process tweaks if provided
        tweaks = body.get("tweaks", {})
        
        # Run the flow
        result = await flow_graph.process(
            input_value=input_value,
            input_type=input_type,
            tweaks=tweaks,
            session_id=session_id
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def stream_generator(queue):
    \"\"\"Generate streaming response from queue.\"\"\"
    while True:
        data = await queue.get()
        if data is None:  # Signal to stop
            break
        yield f"data: {json.dumps(data)}\\n\\n"

@app.post("/stream")
async def stream_flow(request: Request, background_tasks: BackgroundTasks):
    \"\"\"Run the flow with streaming response.\"\"\"
    try:
        # Parse the request body
        body = await request.json()
        
        # Extract input from request
        input_value = body.get("input", "")
        input_type = body.get("input_type", "text")
        session_id = body.get("session_id")
        
        # Process tweaks if provided
        tweaks = body.get("tweaks", {})
        
        # Create queue for streaming
        queue = asyncio.Queue()
        
        # Run the flow in the background
        background_tasks.add_task(
            flow_graph.process_stream,
            queue=queue,
            input_value=input_value,
            input_type=input_type,
            tweaks=tweaks,
            session_id=session_id
        )
        
        return StreamingResponse(
            stream_generator(queue),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
""",
            "flow.py.jinja2": """
\"\"\"
Flow definition module
Generated from Langflow
\"\"\"

import json
import asyncio
from typing import Dict, Any, Optional, List
from langflow.graph.graph.base import Graph

# The flow data as JSON
FLOW_DATA = {{ flow_data }}

def load_flow_from_json():
    \"\"\"Load the flow from the JSON data.\"\"\"
    try:
        # Create a Graph object from the flow data
        graph = Graph.from_payload(FLOW_DATA)
        return FlowProcessor(graph)
    except Exception as e:
        raise ValueError(f"Failed to load flow: {str(e)}")

class FlowProcessor:
    \"\"\"Process the flow with various inputs and handle streaming.\"\"\"
    
    def __init__(self, graph: Graph):
        \"\"\"Initialize with a Graph object.\"\"\"
        self.graph = graph
        self.sessions = {}
    
    async def process(self, input_value: str, input_type: str = "text", 
                     tweaks: Dict[str, Any] = None, session_id: str = None) -> Dict[str, Any]:
        \"\"\"Process the flow with the given input.\"\"\"
        try:
            # Process tweaks if provided
            if tweaks:
                self.graph.update_tweaks(tweaks)
            
            # Run the graph
            result = await self.graph.arun(
                input_value=input_value,
                input_type=input_type,
                session_id=session_id
            )
            
            # Store session if provided
            if session_id:
                self.sessions[session_id] = self.graph.get_session_data(session_id)
            
            return {"result": result, "session_id": session_id}
        except Exception as e:
            raise ValueError(f"Error processing flow: {str(e)}")
    
    async def process_stream(self, queue: asyncio.Queue, input_value: str, 
                           input_type: str = "text", tweaks: Dict[str, Any] = None, 
                           session_id: str = None) -> None:
        \"\"\"Process the flow with streaming output to a queue.\"\"\"
        try:
            # Process tweaks if provided
            if tweaks:
                self.graph.update_tweaks(tweaks)
            
            # Set up streaming callback
            async def stream_callback(data: Dict[str, Any]):
                await queue.put(data)
            
            # Run the graph with streaming
            await self.graph.astream(
                input_value=input_value,
                input_type=input_type,
                session_id=session_id,
                stream_callback=stream_callback
            )
            
            # Store session if provided
            if session_id:
                self.sessions[session_id] = self.graph.get_session_data(session_id)
            
            # Signal end of stream
            await queue.put(None)
        except Exception as e:
            await queue.put({"error": str(e)})
            await queue.put(None)
""",
            "requirements.txt.jinja2": """
fastapi
uvicorn
langflow
python-multipart
pydantic
langchain
jinja2
""",
            "README.md.jinja2": """
# {{ flow_name }}

{{ flow_description }}

This is a FastAPI application generated from a Langflow flow.

## Getting Started

### Running with Docker

The easiest way to run this application is with Docker:

```bash
# Build the Docker image
docker build -t {{ flow_name | lower | replace(" ", "-") }} .

# Run the container
docker run -d -p 8000:8000 --name {{ flow_name | lower | replace(" ", "-") }}-container {{ flow_name | lower | replace(" ", "-") }}
```

The API will be available at http://localhost:8000

### Running locally

If you prefer to run the application locally:

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
uvicorn app.main:app --reload
```

## API Endpoints

- `GET /`: Get API information
- `GET /health`: Health check endpoint
- `POST /run`: Run the flow with input
- `POST /stream`: Run the flow with streaming response

### Example usage

```bash
# Basic request
curl -X POST http://localhost:8000/run \\
  -H "Content-Type: application/json" \\
  -d '{"input": "Your input text here", "input_type": "text"}'

# Streaming request
curl -X POST http://localhost:8000/stream \\
  -H "Content-Type: application/json" \\
  -d '{"input": "Your input text here", "input_type": "text"}'
```

## License

This project is generated from Langflow.
""",
            "Dockerfile.jinja2": """
FROM python:3.10-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
"""
        }
        
        # Create a temporary templates directory
        os.makedirs(templates_dir, exist_ok=True)
        
        # Write the templates to disk
        for template_name, template_content in templates.items():
            with open(os.path.join(templates_dir, template_name), 'w') as f:
                f.write(template_content)
        
        print(f"Created templates in directory: {templates_dir}")
    
    # Generate the application files using templates
    env = Environment(loader=FileSystemLoader(templates_dir))

    # Check if all required templates exist
    required_templates = ["main.py.jinja2", "flow.py.jinja2", "requirements.txt.jinja2", "README.md.jinja2", "Dockerfile.jinja2"]
    for template_name in required_templates:
        template_path = os.path.join(templates_dir, template_name)
        if not os.path.exists(template_path):
            print(f"Template file not found: {template_path}")
            raise ValueError(f"Template file not found: {template_name}")
        else:
            print(f"Template file found: {template_path}")

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


def build_docker_image(app_dir: str, image_name: str) -> Tuple[bool, str]:
    """Build a Docker image from the application directory.

    Args:
        app_dir (str): The directory containing the application
        image_name (str): The name to give the Docker image

    Returns:
        Tuple[bool, str]: A tuple containing a success flag and a message
    """
    try:
        # Check if Docker is available
        try:
            subprocess.run(
                ["docker", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False, "Docker is not available. Please install Docker to build images."
        
        # Sanitize image name to follow Docker naming conventions
        sanitized_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', image_name).lower()
        
        # Build the Docker image
        result = subprocess.run(
            ["docker", "build", "-t", sanitized_name, app_dir],
            capture_output=True,
            text=True,
            check=True
        )
        
        return True, f"Successfully built Docker image: {sanitized_name}"
    except subprocess.CalledProcessError as e:
        return False, f"Failed to build Docker image: {e.stderr}"
    except Exception as e:
        return False, f"Error building Docker image: {str(e)}"


def deploy_container(image_name: str, container_name: str, port: int = 8000) -> Tuple[bool, str, Dict]:
    """Deploy a Docker container from an image.

    Args:
        image_name (str): The name of the Docker image
        container_name (str): The name to give the Docker container
        port (int, optional): The port to expose. Defaults to 8000.

    Returns:
        Tuple[bool, str, Dict]: A tuple containing a success flag, a message, and container info
    """
    try:
        # Check if Docker is available
        try:
            subprocess.run(
                ["docker", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False, "Docker is not available. Please install Docker to deploy containers.", {}
        
        # Sanitize container name to follow Docker naming conventions
        sanitized_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', container_name).lower()
        sanitized_image = re.sub(r'[^a-zA-Z0-9_.-]', '_', image_name).lower()
        
        # Run the Docker container
        result = subprocess.run(
            [
                "docker", "run", "-d",
                "--name", sanitized_name,
                "-p", f"{port}:8000",
                sanitized_image
            ],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Get container info
        container_id = result.stdout.strip()
        inspect_result = subprocess.run(
            ["docker", "inspect", container_id],
            capture_output=True,
            text=True,
            check=True
        )
        
        container_info = {
            "container_id": container_id,
            "container_name": sanitized_name,
            "image_name": sanitized_image,
            "port": port,
            "api_url": f"http://localhost:{port}"
        }
        
        return True, f"Successfully deployed container: {sanitized_name}", container_info
    except subprocess.CalledProcessError as e:
        return False, f"Failed to deploy container: {e.stderr}", {}
    except Exception as e:
        return False, f"Error deploying container: {str(e)}", {}