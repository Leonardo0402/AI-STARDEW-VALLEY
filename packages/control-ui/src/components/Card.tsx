import type { FC, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: FC<CardProps> = ({ children, className = "", hover = false }) => {
  const cls = ["card", hover ? "card--hover" : "", className].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
};
