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
    <div className={cn("overflow-hidden rounded-[1.35rem] bg-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]", className)}>
      {src ? (
        <img src={src} alt={alt} className={cn("h-full w-full object-cover", imageClassName)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#ffffff,transparent_58%),linear-gradient(180deg,#f5f7f4,#e9eeea)] px-3 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
          {fallbackLabel || "No image"}
        </div>
      )}
    </div>
  );
}
