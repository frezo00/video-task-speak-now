export interface FirstFrame {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

const JPEG_QUALITY = 0.75;
const MAX_THUMBNAIL_WIDTH = 320;
const DECODE_TIMEOUT_MS = 5000;

export function extractFirstFrame(blob: Blob, signal?: AbortSignal): Promise<FirstFrame> {
  return new Promise<FirstFrame>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    // Safari refuses to decode a <video> that is not in the DOM. Park it off-screen
    // instead of a DocumentFragment (which also fails on Safari) and pull it back
    // out in the finally path.
    video.style.position = 'fixed';
    video.style.inset = '-9999px';
    video.style.inlineSize = '1px';
    video.style.blockSize = '1px';

    const url = URL.createObjectURL(blob);
    video.src = url;
    document.body.appendChild(video);

    let settled = false;
    const cleanup = (): void => {
      clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      video.parentNode?.removeChild(video);
    };

    const settle = (result: FirstFrame): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const fail = (err: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(toError(err));
    };

    // Some browsers never emit `loadeddata`/`seeked` for pathological blobs.
    // Cap the wait so the thumbnail falls back to the video icon instead of
    // hanging the card in `loading` forever.
    const timeoutId = setTimeout(
      () => fail(new Error('Thumbnail decode timed out')),
      DECODE_TIMEOUT_MS,
    );

    const onAbort = (): void => {
      fail(abortError());
    };
    signal?.addEventListener('abort', onAbort);

    const onError = (): void => {
      fail(video.error ?? new Error('Video failed to decode'));
    };
    video.addEventListener('error', onError);

    const onSeeked = (): void => {
      try {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        if (sourceWidth === 0 || sourceHeight === 0) {
          fail(new Error('Video reported zero dimensions'));
          return;
        }
        const scale = Math.min(1, MAX_THUMBNAIL_WIDTH / sourceWidth);
        const width = Math.round(sourceWidth * scale);
        const height = Math.round(sourceHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context === null) {
          fail(new Error('Canvas 2D context unavailable'));
          return;
        }
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        settle({ dataUrl, width, height });
      } catch (err) {
        fail(err);
      }
    };
    video.addEventListener('seeked', onSeeked);

    const onLoadedData = (): void => {
      // Seeking to 0 on browsers that land past it gets us a deterministic frame.
      // On browsers that are already at 0, the 'seeked' event still fires synchronously.
      try {
        video.currentTime = 0;
      } catch (err) {
        fail(err);
      }
    };
    video.addEventListener('loadeddata', onLoadedData);
  });
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
