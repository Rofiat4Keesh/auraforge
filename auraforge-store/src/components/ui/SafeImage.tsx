"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { GENERIC_FALLBACK_IMAGE } from "@/lib/fallback-image";

interface SafeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fallbackSrc?: string;
}

/**
 * An <img> that swaps to a branded placeholder if the photo link is empty or broken,
 * so product cards, galleries and the cart never show an empty or broken-image box.
 */
export function SafeImage({ src, fallbackSrc = GENERIC_FALLBACK_IMAGE, alt = "", ...rest }: SafeImageProps) {
  const [current, setCurrent] = useState(src || fallbackSrc);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrent(src || fallbackSrc);
  }, [src, fallbackSrc]);

  // A server-rendered image can fail before React is ready to hear its error event,
  // so also check once after the page loads.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && current !== fallbackSrc) {
      setCurrent(fallbackSrc);
    }
  }, [current, fallbackSrc]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      ref={ref}
      src={current}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (current !== fallbackSrc) setCurrent(fallbackSrc);
      }}
    />
  );
}
