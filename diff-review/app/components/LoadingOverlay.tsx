import Logo from "./Logo";

interface LoadingOverlayProps { message: string; subText?: string; }

export default function LoadingOverlay({ message, subText }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <Logo animated />
      <div className="loading-overlay-message">{message}</div>
      {subText && <div className="loading-overlay-subtext">{subText}</div>}
    </div>
  );
}
