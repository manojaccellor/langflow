import useFlowStore from "@/stores/flowStore";
import { useState, useEffect } from "react";
import PublishDropdown from "./deploy-dropdown";
import PlaygroundButton from "./playground-button";
import DeployButton from "./deploy-button";
import { Button } from "@/components/ui/button";
import IconComponent from "@/components/common/genericIconComponent";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import DeployModal from "@/modals/DeployModal";


export default function FlowToolbarOptions() {
  const [open, setOpen] = useState<boolean>(false);
  const [openDeployModal, setOpenDeployModal] = useState(false);
  const hasIO = useFlowStore((state) => state.hasIO);
  const currentFlow = useFlowsManagerStore((state) => state.currentFlow);
  const flowId = currentFlow?.id;

  useEffect(() => {
    console.log("FlowToolbarOptions component rendered", { currentFlow, flowId });
  }, [currentFlow, flowId]);

  const handleDeployClick = () => {
    console.log("Deploy button clicked directly");
    setOpenDeployModal(true);
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-full w-full gap-1.5 rounded-sm transition-all">
        <PlaygroundButton
          hasIO={hasIO}
          open={open}
          setOpen={setOpen}
          canvasOpen
        />
      </div>
      <PublishDropdown />
      
      {/* Direct Deploy Button */}
      <Button
        variant="outline"
        className="!h-8 !w-[95px] font-medium bg-background text-foreground border-border hover:bg-muted"
        onClick={handleDeployClick}
      >
        Deploy
        <IconComponent name="Server" className="icon-size ml-1 font-medium" />
      </Button>
      
      {/* Deploy Modal */}
      <DeployModal
        open={openDeployModal}
        setOpen={setOpenDeployModal}
        flowId={flowId ?? ""}
      />
      
      {/* Original DeployButton component */}
      <div className="hidden">
        <DeployButton />
      </div>
    </div>
  );
}
