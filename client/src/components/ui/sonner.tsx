import { Toaster as Sonner, type ToasterProps } from "sonner";

// The app is a single light "paper" theme, so the toaster is pinned to it
// rather than reading a theme provider we no longer ship.
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
