import type { FC, ReactNode } from "react";

export type BadgeIntent =
  | "idle"
  | "running"
  | "waiting"
  | "blocked"
  | "failed"
  | "paused"
  | "approved"
  | "info"
  | "revision_required"
  | "rejected";

interface BadgeProps {
  intent: BadgeIntent;
  children: ReactNode;
  className?: string;
  title?: string;
}

export const Badge: FC<BadgeProps> = ({ intent, children, className = "", title }) => {
  return (
    <span
      className={["badge", `badge--${intent}`, className].filter(Boolean).join(" ")}
      data-testid="badge"
      title={title}
    >
      {children}
    </span>
  );
};
