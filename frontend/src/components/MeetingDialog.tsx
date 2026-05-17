import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { MeetingRecorder } from "./MeetingRecorder";

interface MeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
}

export const MeetingDialog: React.FC<MeetingDialogProps> = ({
  open,
  onOpenChange,
  meetingId
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="!max-w-[780px] !w-full !rounded-[14px] !p-0 !gap-0 border border-black/8 dark:border-white/8 shadow-2xl overflow-hidden bg-background"
      >
        <VisuallyHidden.Root>
          <DialogTitle>Meeting Studio</DialogTitle>
        </VisuallyHidden.Root>
        <MeetingRecorder onClose={() => onOpenChange(false)} meetingId={meetingId} />
      </DialogContent>
    </Dialog>
  );
};
