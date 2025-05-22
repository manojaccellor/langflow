// src/frontend/src/modals/DeployModal/index.tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from "@/services/api";
import useAlertStore from "@/stores/alertStore";
import { useState } from "react";
import { CopyToClipboard } from "@/components/ui/copy-to-clipboard";
import { ExternalLink } from "lucide-react";

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
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const setSuccessData = useAlertStore((state) => state.setSuccessData);

  const handleDeploy = async () => {
    if (!flowId) {
      setErrorData({
        title: "Cannot deploy flow",
        list: ["Flow ID is not valid"],
      });
      return;
    }

    setIsDeploying(true);
    try {
      // Use the correct endpoint from endpoints.py
      const response = await api.post(`/api/v1/flows/${flowId}/deploy`, {});

      // For the file download response, we need to handle it differently
      if (response.headers['content-type']?.includes('application/zip')) {
        // Create a download link for the zip file
        const blob = new Blob([response.data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${flowId}_fastapi_app.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Set a local URL for display purposes
        setDeployedUrl("Local FastAPI app downloaded");
        setDocsUrl("See README.md in the downloaded zip file");
      } else {
        // For API-based deployment
        if (response.data) {
          if (response.data.api_url) {
            setDeployedUrl(response.data.api_url);
          }
          if (response.data.docs_url) {
            setDocsUrl(response.data.docs_url);
          }
        }
      }

      setSuccessData({
        title: "Flow deployed successfully",
      });

    } catch (error: any) {
      setErrorData({
        title: "Failed to deploy flow",
        list: [error?.message || "Unknown error occurred"],
      });
      setOpen(false);
    } finally {
      setIsDeploying(false);
    }
  };

  const pythonCode = `
import requests

# Replace with your deployed API URL
API_URL = "${deployedUrl}/predict"

def query_flow(question):
    response = requests.post(
        API_URL,
        json={"query": question}
    )
    return response.json()

# Example usage
result = query_flow("What is machine learning?")
print(result)
`;

  const javascriptCode = `
// Replace with your deployed API URL
const API_URL = "${deployedUrl}/predict";

async function queryFlow(question) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: question })
  });
  
  return await response.json();
}

// Example usage
queryFlow("What is machine learning?")
  .then(result => console.log(result))
  .catch(error => console.error('Error:', error));
`;

  const curlCode = `
curl -X POST "${deployedUrl}/predict" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "What is machine learning?"}'
`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Deploy Flow as FastAPI Application</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {!deployedUrl ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                This will deploy your flow as a standalone FastAPI application that
                can be accessed via API endpoints. You'll get code snippets to easily
                integrate it into your applications.
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="bg-background text-foreground border-border hover:bg-muted"
                >
                  {isDeploying ? "Deploying..." : "Deploy as FastAPI App"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Your flow has been deployed successfully! You can access it at:
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
