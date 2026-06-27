import { useState, useCallback } from 'react';
import { ImageIcon, ZoomIn, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  enableZoom?: boolean;
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function SafeImage({ 
  src, 
  alt, 
  className = '', 
  containerClassName = '',
  enableZoom = true,
  fallbackSrc,
  onLoad,
  onError 
}: SafeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
    onError?.();
  }, [onError]);

  const displaySrc = error && fallbackSrc ? fallbackSrc : src;

  return (
    <>
      <div className={`relative ${containerClassName}`}>
        {!loaded && (
          <div className="absolute inset-0 bg-muted animate-pulse rounded-lg flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}
        
        <img
          src={displaySrc}
          alt={alt}
          className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 ${error ? 'grayscale' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />

        {enableZoom && loaded && !error && (
          <button
            onClick={() => setZoomed(true)}
            className="absolute bottom-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Zoom image"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}
          >
            <button 
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
              onClick={() => setZoomed(false)}
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={displaySrc} 
              alt={alt} 
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function ImageGrid({ images, alt }: { images: string[]; alt: string }) {
  if (!images?.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
      {images.map((img, idx) => (
        <SafeImage
          key={`${img}-${idx}`}
          src={img}
          alt={`${alt} - image ${idx + 1}`}
          className="w-full rounded-lg border"
          containerClassName="aspect-video"
        />
      ))}
    </div>
  );
}
