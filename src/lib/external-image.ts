export type ExternalImageSource = {
  originalUrl: string;
  displayUrl: string;
  provider: "sharepoint" | "onedrive" | "external" | "data";
};

function isSharePointHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host.endsWith(".sharepoint.com") || host.endsWith(".sharepoint-df.com");
}

function isOneDriveHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "1drv.ms"
    || host.endsWith(".1drv.ms")
    || host === "onedrive.live.com"
    || host.endsWith(".onedrive.live.com");
}

export function normalizeExternalImageUrl(value: string): ExternalImageSource {
  const originalUrl = value.trim();
  if (!originalUrl) {
    return { originalUrl: "", displayUrl: "", provider: "external" };
  }

  if (originalUrl.startsWith("data:image/")) {
    return { originalUrl, displayUrl: originalUrl, provider: "data" };
  }

  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    throw new Error("La URL de la imagen no es válida.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("La imagen debe usar una URL http o https.");
  }

  if (isSharePointHost(url.hostname)) {
    // Los enlaces compartidos de SharePoint / OneDrive empresarial del tipo /:i:/g/
    // abren una página de vista previa. download=1 hace que Microsoft entregue el archivo.
    url.searchParams.delete("web");
    url.searchParams.set("download", "1");
    return {
      originalUrl,
      displayUrl: url.toString(),
      provider: "sharepoint",
    };
  }

  if (isOneDriveHost(url.hostname)) {
    url.searchParams.delete("web");
    url.searchParams.set("download", "1");
    return {
      originalUrl,
      displayUrl: url.toString(),
      provider: "onedrive",
    };
  }

  return {
    originalUrl,
    displayUrl: originalUrl,
    provider: "external",
  };
}

export function isMicrosoftCloudImage(value: string) {
  try {
    const url = new URL(value);
    return isSharePointHost(url.hostname) || isOneDriveHost(url.hostname);
  } catch {
    return false;
  }
}
