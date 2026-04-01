import { cn } from "@/lib/utils";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  fallbackLabel?: string;
  className?: string;
  imageClassName?: string;
};

export function ProductImage({ src, alt, fallbackLabel, className, imageClassName }: ProductImageProps) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-slate-100", className)}>
      {src ? (
        <img src={src} alt={alt} className={cn("h-full w-full object-cover", imageClassName)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#f8fafc,transparent_65%),linear-gradient(180deg,#f1f5f9,#e2e8f0)] px-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          {fallbackLabel || "No image"}
        </div>
      )}
    </div>
  );
}
