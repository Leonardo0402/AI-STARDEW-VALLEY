import type { FC } from "react";
import { Badge, type BadgeIntent } from "./Badge.js";

interface SectionHeaderProps {
  title: string;
  count?: number;
  countIntent?: BadgeIntent;
  className?: string;
}

export const SectionHeader: FC<SectionHeaderProps> = ({
  title,
  count,
  countIntent = "info",
  className = "",
}) => {
  return (
    <h3 className={["section-header", className].filter(Boolean).join(" ")}>
      <span className="section-header__title">{title}</span>
      {count !== undefined && (
        <Badge intent={countIntent} className="badge--count">
          {count}
        </Badge>
      )}
    </h3>
  );
};
