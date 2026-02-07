import { cn } from "@/lib/utils";

interface OECLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function OECLoader({ size = "md", className, text }: OECLoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative">
        {/* Spinning ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 border-r-cyan-500/50 animate-spin",
            sizeClasses[size]
          )}
          style={{ animationDuration: "1s" }}
        />
        {/* Outer glow ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border border-cyan-500/20 animate-pulse",
            sizeClasses[size]
          )}
        />
        {/* Logo */}
        <img
          src="/oec-logo.png"
          alt="OEC"
          className={cn(
            "rounded-full object-cover animate-pulse",
            sizeClasses[size]
          )}
          style={{ animationDuration: "2s" }}
        />
      </div>
      {text && (
        <span className="text-sm text-gray-400 animate-pulse">{text}</span>
      )}
    </div>
  );
}
