import React from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { MeetingsSidebar } from "@/components/meetings/MeetingsSidebar";

/**
 * Meetings page layout with sidebar and content area.
 */
export function MeetingsPage() {
  const { pageId } = useParams(); // placeholder for future nested routing
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <MeetingsSidebar onClose={() => undefined} />
      <div className="flex-1 overflow-auto">
        {/* Render nested meeting routes or home component */}
        <Outlet />
      </div>
    </div>
  );
}
