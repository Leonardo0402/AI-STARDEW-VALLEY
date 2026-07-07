import type { ArtifactView } from "@agent-office/protocol";
import type { BadgeIntent } from "./Badge.js";

export function artifactStatusIntent(status: ArtifactView["status"]): BadgeIntent {
  switch (status) {
    case "draft":
      return "idle";
    case "generated":
      return "info";
    case "under_review":
      return "waiting";
    case "revision_required":
      return "revision_required";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "delivered":
      return "running";
    default:
      return "info";
  }
}
