// src/frontend/src/modals/DeployModal/index.tsx  
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import useAlertStore from "@/stores/alertStore";
import api from "@/services/api";

interface DeployModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    flowId: string;
}

export default function DeployModal({ open, setOpen, flowId }: DeployModalProps) {
    const [isDeploying, setIsDeploying] = useState(false);
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
            const response = await api.post(`/api/v1/flows/${flowId}/deploy`, {});

            // Provide download link or deployment info  
            setSuccessData({
                title: "Flow deployed successfully",
                list: ["Your flow has been packaged as a FastAPI application"],
            });

            // If the response includes a download URL  
            if (response.data.download_url) {
                window.open(response.data.download_url, "_blank");
            }

            setOpen(false);
        } catch (error) {
            setErrorData({
                title: "Failed to deploy flow",
                list: [error.message || "Unknown error occurred"],
            });
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Deploy Flow as FastAPI Application</DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                        This will package your flow as a standalone FastAPI application that can be deployed anywhere.
                    </p>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeploy}
                            disabled={isDeploying}
                            className="bg-blue-500 hover:bg-blue-600"
                        >
                            {isDeploying ? "Deploying..." : "Deploy as FastAPI App"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}