// src/frontend/src/components/core/flowToolbarComponent/components/deploy-button.tsx  
import IconComponent from "@/components/common/genericIconComponent";
import ShadTooltipComponent from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import api from "@/services/api";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import useAlertStore from "@/stores/alertStore";
import DeployModal from "@/modals/DeployModal";


import { Switch } from "@/components/ui/switch";
import { usePatchUpdateFlow } from "@/controllers/API/queries/flows/use-patch-update-flow";
import { CustomLink } from "@/customization/components/custom-link";
import { ENABLE_PUBLISH, ENABLE_WIDGET } from "@/customization/feature-flags";
import { customMcpOpen } from "@/customization/utils/custom-mcp-open";
import ApiModal from "@/modals/apiModal/new-api-modal";
import EmbedModal from "@/modals/EmbedModal/embed-modal";
import useAlertStore from "@/stores/alertStore";
import useAuthStore from "@/stores/authStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import useFlowStore from "@/stores/flowStore";
import { cn } from "@/utils/utils";
import { useState } from "react";
import { useHref } from "react-router-dom";

export default function DeployButton() {
    const [openDeployModal, setOpenDeployModal] = useState(false);
    const currentFlow = useFlowsManagerStore((state) => state.currentFlow);
    const flowId = currentFlow?.id;
    const setErrorData = useAlertStore((state) => state.setErrorData);

    const handleDeployClick = () => {
        if (!flowId) {
            setErrorData({
                title: "Cannot deploy flow",
                list: ["No flow is currently selected"],
            });
            return;
        }
        setOpenDeployModal(true);
    };

    return (
        <>
            <ShadTooltipComponent content="Deploy as FastAPI application">
                <Button
                    variant="default"
                    className="!h-8 !w-[95px] font-medium"
                    data-testid="deploy-button"
                    onClick={handleDeployClick}
                >
                    Deploy
                    <IconComponent
                        name="Server"
                        className="icon-size font-medium ml-1"
                    />
                </Button>
            </ShadTooltipComponent>

            <DeployModal
                open={openDeployModal}
                setOpen={setOpenDeployModal}
                flowId={flowId ?? ""}
            />
        </>
    );
}