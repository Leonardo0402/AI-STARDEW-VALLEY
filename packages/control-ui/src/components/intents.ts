import type { ArtifactView } from "@agent-office/protocol";
import type { BadgeIntent } from "./Badge.js";

export function artifactStatusIntent(status: ArtifactView["status"]): BadgeIntent {
  switch (status) {
    case "draft":
      return "idle";
    case "generated":
      return "info";
    case "under_review":
    case "revision_required":
      return "waiting";
    case "approved":
      return "approved";
    case "rejected":
      return "failed";
    case "delivered":
      return "running";
    default:
      return "info";
  }
}
