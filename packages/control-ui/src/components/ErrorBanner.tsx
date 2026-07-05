import type { FC } from "react";

interface ErrorBannerProps {
  code?: string;
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner: FC<ErrorBannerProps> = ({ code, message, onDismiss }) => {
  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__body">
        {code && <span className="error-banner__code">{code}</span>}
        <span className="error-banner__message">{message}</span>
      </div>
      {onDismiss && (
        <button className="btn btn--secondary btn--small" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
};
