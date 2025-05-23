// src/frontend/src/modals/DeployModal/index.tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from "@/services/api";
import useAlertStore from "@/stores/alertStore";
import { useState } from "react";
import { CopyToClipboard } from "@/components/ui/copy-to-clipboard";
import { ExternalLink, Download, Box } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface DeployModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  flowId: string;
}

export default function DeployModal({
  open,
  setOpen,
  flowId,
}: DeployModalProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("python");
  const [deploymentType, setDeploymentType] = useState<"download" | "container">("download");
  const [port, setPort] = useState(8000);
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [containerInfo, setContainerInfo] = useState<any>(null);
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const setSuccessData = useAlertStore((state) => state.setSuccessData);

  const handleDownloadApp = async () => {
    if (!flowId) {
      setErrorData({
        title: "Cannot deploy flow",
        list: ["Flow ID is not valid"],
      });
      return;
    }

    setIsDeploying(true);
    try {
      // Make sure we're using the correct URL format with the flow ID
      // The URL should match the API endpoint defined in the backend
      // Remove the /api/v1 prefix as it's already in the baseURL
      const downloadUrl = `/flows/${flowId}/deploy`;
      console.log("Downloading app from:", downloadUrl);
      
      // Try direct download approach with proper URL
      window.open(`/api/v1${downloadUrl}`, '_blank');
      
      // Set a local URL for display purposes
      setDeployedUrl("FastAPI app download initiated");
      setDocsUrl("See README.md in the downloaded zip file");

      setSuccessData({
        title: "Flow deployed successfully",
      });

    } catch (error: any) {
      console.error("Error deploying flow:", error);
      setErrorData({
        title: "Failed to deploy flow",
        list: [error?.response?.data?.detail || error?.message || "Unknown error occurred"],
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleContainerize = async () => {
    if (!flowId) {
      setErrorData({
        title: "Cannot containerize flow",
        list: ["Flow ID is not valid"],
      });
      return;
    }

    setIsDeploying(true);
    try {
      // Make sure we're using the correct URL format with the flow ID
      // The URL should match the API endpoint defined in the backend
      // Remove the /api/v1 prefix as it's already in the baseURL
      const containerizeUrl = `/flows/${flowId}/containerize`;
      console.log("Containerizing flow using:", containerizeUrl);
      
      // Send parameters in the request body
      const response = await api.post(containerizeUrl, {
        port: port,
        auto_deploy: autoDeploy
      });

      if (response.data) {
        setContainerInfo(response.data);
        
        // Check if there was an error with Docker
        if (response.data.message && response.data.message.includes("Docker is not available")) {
          setErrorData({
            title: "Docker not available",
            list: ["Docker is not installed or not running. Please install Docker to use containerization features."]
          });
          setOpen(false);
          return;
        }
        
        if (response.data.container_info && response.data.container_info.api_url) {
          setDeployedUrl(response.data.container_info.api_url);
        } else {
          setDeployedUrl(`Docker image: ${response.data.image_name}`);
        }
        setDocsUrl(autoDeploy ? `${response.data.container_info?.api_url}/docs` : null);
      }

      setSuccessData({
        title: "Flow containerized successfully",
      });

    } catch (error: any) {
      console.error("Error containerizing flow:", error);
      
      // Check if the error is related to Docker
      if (error?.response?.data?.detail?.includes("Docker")) {
        setErrorData({
          title: "Docker not available",
          list: ["Docker is not installed or not running. Please install Docker to use containerization features."]
        });
      } else {
        setErrorData({
          title: "Failed to containerize flow",
          list: [error?.response?.data?.detail || error?.message || "Unknown error occurred"],
        });
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeploy = async () => {
    if (deploymentType === "download") {
      await handleDownloadApp();
    } else {
      await handleContainerize();
    }
  };

  const pythonCode = `
import requests

# Replace with your deployed API URL
API_URL = "${deployedUrl}/run"

def query_flow(input_value, input_type="text"):
    response = requests.post(
        API_URL,
        json={
            "input": input_value,
            "input_type": input_type,
            "tweaks": {}
        }
    )
    return response.json()

# Example usage
result = query_flow("What is machine learning?")
print(result)
`;

  const javascriptCode = `
// Replace with your deployed API URL
const API_URL = "${deployedUrl}/run";

async function queryFlow(inputValue, inputType = "text") {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: inputValue,
      input_type: inputType,
      tweaks: {}
    })
  });
  
  return await response.json();
}

// Example usage
queryFlow("What is machine learning?")
  .then(result => console.log(result))
  .catch(error => console.error('Error:', error));
`;

  const curlCode = `
curl -X POST "${deployedUrl}/run" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "What is machine learning?",
    "input_type": "text",
    "tweaks": {}
  }'
`;

  const dockerRunCommand = containerInfo ? `
docker run -d -p ${port}:8000 --name ${containerInfo.image_name}-container ${containerInfo.image_name}
` : '';

  const generateDeploymentScript = (imageName: string, port: number): string => {
    return `#!/bin/bash
# Langflow Docker Deployment Script
# Generated automatically for ${imageName}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Pull the image if it exists in Docker Hub (uncomment and modify)
# docker pull yourusername/${imageName}:latest

# Run the container
echo "Starting container..."
docker run -d -p ${port}:8000 --name ${imageName}-container ${imageName}

# Check if the container is running
if [ $? -eq 0 ]; then
    echo "Container started successfully!"
    echo "API is available at: http://localhost:${port}"
    echo "API documentation: http://localhost:${port}/docs"
else
    echo "Failed to start container. Check Docker logs for more information."
    exit 1
fi

# Optional: Push to Docker Hub (uncomment and modify)
# echo "Pushing image to Docker Hub..."
# docker tag ${imageName} yourusername/${imageName}:latest
# docker push yourusername/${imageName}:latest

echo "Deployment complete!"
`;
  };

  const downloadDeploymentScript = () => {
    if (!containerInfo) {
      setErrorData({
        title: "Cannot download script",
        list: ["Container information not available"],
      });
      return;
    }
    
    const scriptContent = generateDeploymentScript(containerInfo.image_name, port);
    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deploy-langflow.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setSuccessData({
      title: "Deployment script downloaded",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Deploy Flow as API</DialogTitle>
          <DialogDescription>
            Deploy your flow as a standalone API that can be used by other applications.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {!deployedUrl ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Choose how you want to deploy your flow:
              </p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div 
                  className={`p-4 border rounded-md cursor-pointer ${
                    deploymentType === "download" ? "border-primary bg-muted" : "border-border"
                  }`}
                  onClick={() => setDeploymentType("download")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="h-5 w-5" />
                    <h3 className="font-medium">Download as App</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get a FastAPI application as a ZIP file that you can host anywhere.
                  </p>
                </div>

                <div 
                  className={`p-4 border rounded-md cursor-pointer ${
                    deploymentType === "container" ? "border-primary bg-muted" : "border-border"
                  }`}
                  onClick={() => setDeploymentType("container")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Box className="h-5 w-5" />
                    <h3 className="font-medium">Docker Container</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Build a Docker container that can be deployed locally or to the cloud.
                  </p>
                </div>
              </div>

              {deploymentType === "container" && (
                <div className="space-y-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value))}
                      placeholder="8000"
                    />
                    <p className="text-xs text-muted-foreground">
                      The port to expose the container on your host machine.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-deploy"
                      checked={autoDeploy}
                      onCheckedChange={(checked) => setAutoDeploy(!!checked)}
                    />
                    <Label htmlFor="auto-deploy">
                      Auto-deploy container after building
                    </Label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="bg-background text-foreground border-border hover:bg-muted"
                >
                  {isDeploying ? "Deploying..." : deploymentType === "download" ? "Download App" : "Build Container"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {deploymentType === "download" 
                  ? "Your flow has been downloaded as a FastAPI application!" 
                  : "Your flow has been containerized successfully!"}
              </p>
              
              <div className="mb-4 rounded-md bg-muted p-3 flex items-center justify-between">
                <code className="text-sm">{deployedUrl}</code>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(deployedUrl || "");
                    setSuccessData({
                      title: "URL copied",
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="ml-2"
                >
                  Copy
                </Button>
              </div>

              {docsUrl && (
                <div className="mb-4">
                  <a 
                    href={docsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-blue-500 hover:text-blue-700"
                  >
                    View API Documentation <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              )}
              
              {containerInfo && (
                <>
                  <Separator className="my-4" />
                  
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Docker Information</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground">Image Name:</span>
                        <div className="rounded-md bg-muted p-2 mt-1">
                          <code className="text-xs">{containerInfo.image_name}</code>
                        </div>
                      </div>
                      
                      {containerInfo.container_info && (
                        <div>
                          <span className="text-xs text-muted-foreground">Container:</span>
                          <div className="rounded-md bg-muted p-2 mt-1">
                            <code className="text-xs">{containerInfo.container_info.container_name}</code>
                          </div>
                        </div>
                      )}
                      
                      {!containerInfo.container_info && (
                        <div>
                          <span className="text-xs text-muted-foreground">Run Container:</span>
                          <div className="relative">
                            <pre className="rounded-md bg-muted p-2 mt-1 text-xs overflow-x-auto">
                              {dockerRunCommand}
                            </pre>
                            <CopyToClipboard 
                              value={dockerRunCommand} 
                              className="absolute top-2 right-2"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-xs text-muted-foreground">Deployment Instructions:</span>
                        <div className="rounded-md bg-muted p-3 mt-1">
                          <p className="text-xs mb-2">To deploy your containerized flow:</p>
                          <ol className="text-xs list-decimal pl-4 space-y-1">
                            <li>Make sure Docker is installed and running</li>
                            <li>Run the container using the command above</li>
                            <li>Access the API at <code>http://localhost:{port}</code></li>
                            <li>For cloud deployment, push the image to Docker Hub:</li>
                          </ol>
                          <pre className="text-xs mt-2 p-2 bg-gray-800 text-gray-200 rounded overflow-x-auto">
{`# Tag the image (replace 'yourusername')
docker tag ${containerInfo.image_name} yourusername/${containerInfo.image_name}:latest

# Push to Docker Hub
docker push yourusername/${containerInfo.image_name}:latest`}
                          </pre>
                          <CopyToClipboard 
                            value={`docker tag ${containerInfo.image_name} yourusername/${containerInfo.image_name}:latest\ndocker push yourusername/${containerInfo.image_name}:latest`} 
                            className="absolute top-2 right-2"
                          />
                          
                          <div className="mt-3 flex justify-end">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={downloadDeploymentScript}
                              className="text-xs"
                            >
                              Download Deployment Script
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                </>
              )}
              
              <p className="mb-4 text-sm text-muted-foreground">
                Use the code snippets below to integrate with your applications:
              </p>

              <Tabs defaultValue="python" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                </TabsList>
                <TabsContent value="python" className="mt-2">
                  <div className="relative">
                    <pre className="rounded-md bg-muted p-4 overflow-x-auto text-sm">
                      {pythonCode}
                    </pre>
                    <CopyToClipboard 
                      value={pythonCode} 
                      className="absolute top-2 right-2"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="javascript" className="mt-2">
                  <div className="relative">
                    <pre className="rounded-md bg-muted p-4 overflow-x-auto text-sm">
                      {javascriptCode}
                    </pre>
                    <CopyToClipboard 
                      value={javascriptCode}
                      className="absolute top-2 right-2"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="curl" className="mt-2">
                  <div className="relative">
                    <pre className="rounded-md bg-muted p-4 overflow-x-auto text-sm">
                      {curlCode}
                    </pre>
                    <CopyToClipboard 
                      value={curlCode}
                      className="absolute top-2 right-2"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end mt-4">
                <Button onClick={() => setOpen(false)}>Close</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}