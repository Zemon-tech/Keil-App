interface OptimizeOptions {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

/**
 * Helper to get optimized image URL using AWS Dynamic Image Transformation CDN.
 * Falls back to raw public S3 URL if VITE_IMAGE_CDN_URL is not set.
 */
export function getOptimizedImageUrl(
  s3UrlOrKey: string | null | undefined,
  options: OptimizeOptions = {}
): string {
  if (!s3UrlOrKey) return "";

  // 1. Detect social provider / external images and return directly
  if (s3UrlOrKey.startsWith("http://") || s3UrlOrKey.startsWith("https://")) {
    try {
      const url = new URL(s3UrlOrKey);
      const cdnUrl = import.meta.env.VITE_IMAGE_CDN_URL;
      const isS3 = url.hostname.includes("amazonaws.com") && url.hostname.includes("keil-app-public");
      const isCDN = cdnUrl ? url.hostname === new URL(cdnUrl).hostname : false;

      if (!isS3 && !isCDN) {
        return s3UrlOrKey;
      }
    } catch (e) {
      return s3UrlOrKey;
    }
  }

  // 2. Extract S3 key
  let key = s3UrlOrKey;
  if (s3UrlOrKey.startsWith("http://") || s3UrlOrKey.startsWith("https://")) {
    try {
      const url = new URL(s3UrlOrKey);
      key = url.pathname.replace(/^\//, "");
    } catch (e) {
      // ignore
    }
  }

  const cdnUrl = import.meta.env.VITE_IMAGE_CDN_URL;
  if (!cdnUrl) {
    // If CDN URL is not configured, fall back to standard S3 public URL
    const bucket = import.meta.env.VITE_S3_PUBLIC_BUCKET || "keil-app-public";
    return `https://${bucket}.s3.ap-south-1.amazonaws.com/${key}`;
  }

  // 3. Construct resizing request
  const bucket = import.meta.env.VITE_S3_PUBLIC_BUCKET || "keil-app-public";
  const requestObj: any = {
    bucket,
    key,
  };

  if (options.width || options.height) {
    requestObj.edits = {
      resize: {
        width: options.width,
        height: options.height,
        fit: options.fit || "cover",
      },
    };
  }

  try {
    const jsonStr = JSON.stringify(requestObj);
    // Base64 encode the JSON string safely
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const cleanCdnUrl = cdnUrl.endsWith("/") ? cdnUrl.slice(0, -1) : cdnUrl;
    return `${cleanCdnUrl}/${base64}`;
  } catch (e) {
    console.error("Failed to generate optimized image URL:", e);
    return s3UrlOrKey;
  }
}
