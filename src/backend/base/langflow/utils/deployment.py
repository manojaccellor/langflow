"""Utilities for deploying flows as FastAPI applications."""
import json
import os
import tempfile
import uuid
from typing import Dict, Any, Optional
import shutil
import subprocess
from pathlib import Path
import importlib.resources

from langflow.services.database.models.flow import Flow
from langflow.logging import logger


FASTAPI_TEMPLATE = """
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import json
import importlib.util
import sys
from typing import Dict, Any, Optional, List
import os

app = FastAPI(
    title="{flow_name} API",
    description="API deployed from a Langflow flow",
    version="1.0.0",
)

# Load flow data
FLOW_DATA = {flow_data}

# Import necessary components
{imports}

# Initialize components
{init_components}

@app.get("/")
async def root():
    return {{
        "message": "Welcome to the {flow_name} API",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "endpoints": [
            {{
                "path": "/predict",
                "method": "POST",
                "description": "Run inference on the flow"
            }},
            {{
                "path": "/health",
                "method": "GET",
                "description": "Check if the API is healthy"
            }}
        ]
    }}

class QueryModel(BaseModel):
    query: str
    {input_fields}
    
    class Config:
        schema_extra = {{
            "example": {{
                "query": "What is machine learning?"
            }}
        }}

@app.post("/predict")
async def predict(request: QueryModel):
    # Run inference on the flow with the provided query
    try:
        # Process input through flow
        {process_code}
        
        return {{"result": result}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    # Check if the API is healthy
    return {{"status": "healthy"}}
"""


async def generate_fastapi_app(flow: Flow) -> Dict[str, Any]:
    """Generate a FastAPI application from a flow."""
    try:
        # Create a temporary directory with a unique name based on flow ID
        deploy_dir = Path(tempfile.gettempdir()) / f"langflow_deploy_{flow.id}"
        deploy_dir.mkdir(exist_ok=True, parents=True)
        
        # Parse the flow data
        flow_data = json.loads(flow.data)
        
        # Get imports, component initialization, and processing code
        imports, init_components, process_code, input_fields = _generate_code_from_flow(flow_data)
        
        # Generate the FastAPI app code
        fastapi_code = FASTAPI_TEMPLATE.format(
            flow_name=flow.name,
            flow_data=json.dumps(flow_data),
            imports=imports,
            init_components=init_components,
            process_code=process_code,
            input_fields=input_fields
        )
        
        # Write the FastAPI app to a file
        app_file = deploy_dir / "main.py"
        with open(app_file, "w") as f:
            f.write(fastapi_code)
            
        # Create requirements.txt
        with open(deploy_dir / "requirements.txt", "w") as f:
            f.write("fastapi>=0.68.0\n")
            f.write("uvicorn>=0.15.0\n")
            f.write("pydantic>=1.8.2\n")
            f.write("langchain>=0.0.267\n")
            
        # Create a README.md file with deployment instructions
        with open(deploy_dir / "README.md", "w") as f:
            f.write(f"# {flow.name} API\n\n")
            f.write("This is a FastAPI application generated from a Langflow flow.\n\n")
            f.write("## Running the API\n\n")
            f.write("1. Install the requirements:\n")
            f.write("```bash\npip install -r requirements.txt\n```\n\n")
            f.write("2. Run the API:\n")
            f.write("```bash\nuvicorn main:app --host 0.0.0.0 --port 8000\n```\n\n")
            f.write("## API Documentation\n\n")
            f.write("- Swagger UI: http://localhost:8000/docs\n")
            f.write("- ReDoc: http://localhost:8000/redoc\n\n")
            
        # Run uvicorn server to get the URL
        port = _find_available_port()
        process = subprocess.Popen(
            ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(port)],
            cwd=deploy_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        
        # Wait for server to start
        logger.info(f"Started FastAPI server for flow {flow.name} on port {port}")
        
        # Return deployment info
        return {
            "api_url": f"http://localhost:{port}",
            "docs_url": f"http://localhost:{port}/docs",
            "deploy_dir": str(deploy_dir),
            "pid": process.pid,
        }
        
    except Exception as e:
        logger.error(f"Error generating FastAPI app: {e}")
        raise e


def _generate_code_from_flow(flow_data: Dict[str, Any]) -> tuple:
    """Generate code from flow data."""
    nodes = flow_data.get("data", {}).get("nodes", [])
    edges = flow_data.get("data", {}).get("edges", [])
    
    # Generate imports
    imports = [
        "from langchain.llms import OpenAI",
        "from langchain.chains import LLMChain",
        "from langchain.prompts import PromptTemplate",
    ]
    
    # Generate component initialization
    init_components = []
    for node in nodes:
        node_type = node.get("type", "")
        if "LLM" in node_type:
            init_components.append(f'llm = OpenAI(temperature=0.7)')
        elif "PromptTemplate" in node_type:
            init_components.append(f'prompt = PromptTemplate(template="{{query}}", input_variables=["query"])')
        elif "Chain" in node_type:
            init_components.append(f'chain = LLMChain(llm=llm, prompt=prompt)')
    
    # Generate process code
    process_code = [
        "# Process the input through the flow",
        "result = chain.run(query=request.query)"
    ]
    
    # Generate input fields
    input_fields = []
    
    return "\n".join(imports), "\n".join(init_components), "\n".join(process_code), "\n".join(input_fields)


def _find_available_port(start_port: int = 8000, max_port: int = 9000) -> int:
    """Find an available port."""
    import socket
    
    port = start_port
    while port <= max_port:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
        port += 1
    
    raise RuntimeError(f"No available port found in range {start_port}-{max_port}") 