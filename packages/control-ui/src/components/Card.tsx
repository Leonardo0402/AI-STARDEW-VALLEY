import type { FC, ReactNode, KeyboardEvent, MouseEvent } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  selected?: boolean;
  selectable?: boolean;
  ariaLabel?: string;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export const Card: FC<CardProps> = ({
  children,
  className = "",
  hover = false,
  selected = false,
  selectable = false,
  ariaLabel,
  onClick,
  onKeyDown,
}) => {
  const cls = [
    "card",
    hover ? "card--hover" : "",
    selectable ? "card--selectable" : "",
    selected ? "card--selected" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      role={selectable ? "button" : undefined}
      aria-pressed={selectable ? selected : undefined}
      aria-label={ariaLabel}
      tabIndex={selectable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
};
