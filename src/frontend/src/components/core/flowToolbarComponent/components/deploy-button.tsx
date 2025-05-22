// src/frontend/src/components/core/flowToolbarComponent/components/deploy-button.tsx
import IconComponent from "@/components/common/genericIconComponent";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import DeployModal from "@/modals/DeployModal";
import useAlertStore from "@/stores/alertStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import { useState, useEffect } from "react";

export default function DeployButton() {
  const [openDeployModal, setOpenDeployModal] = useState(false);
  const currentFlow = useFlowsManagerStore((state) => state.currentFlow);
  const flowId = currentFlow?.id;
  const setErrorData = useAlertStore((state) => state.setErrorData);

  useEffect(() => {
    console.log("DeployButton component rendered", { flowId });
  }, [flowId]);

  const handleDeployClick = () => {
    console.log("Deploy button clicked");
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
      <Button
        variant="destructive"
        className="!h-8 !w-[95px] font-medium"
        data-testid="deploy-button"
        onClick={handleDeployClick}
      >
        Deploy
        <IconComponent name="Server" className="icon-size ml-1 font-medium" />
      </Button>
      
      <DeployModal
        open={openDeployModal}
        setOpen={setOpenDeployModal}
        flowId={flowId ?? ""}
      />
    </>
  );
}