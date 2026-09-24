"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { externalImageDisplayUrl, isMicrosoftCloudImage } from "@/lib/external-image";

type ExternalImageProps = {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
};

export function ExternalImage({
  src,
  alt,
  className,
  fallbackClassName,
}: ExternalImageProps) {
  const [failed, setFailed] = useState(false);
  const displayUrl = externalImageDisplayUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!displayUrl || failed) {
    return (
      <div className={cn(
        "flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground",
        fallbackClassName,
      )}>
        <ImageOff className="h-5 w-5" />
        <span>
          {isMicrosoftCloudImage(src)
            ? "No se pudo abrir la imagen. En OneDrive/SharePoint use “Cualquier persona con el vínculo puede ver”."
            : "No se pudo cargar la imagen."}
        </span>
      </div>
    );
  }

  return (
    <img
      src={displayUrl}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
