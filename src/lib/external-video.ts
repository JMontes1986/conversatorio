export type VideoSource =
  | { kind: "youtube"; id: string; original: string }
  | { kind: "direct"; url: string; original: string; provider: "sharepoint" | "onedrive" | "external" }
  | { kind: "iframe"; url: string; original: string; provider: "external" };

function extractIframeSrc(value: string) {
  const match = value.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
  return match?.[1]?.trim() || null;
}

function youtubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.replace(/^\//, "") || null;
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/embed/")[1]?.split("/")[0] || null;
      return url.searchParams.get("v");
    }
  } catch {}
  return null;
}

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

function directMicrosoftVideoUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.searchParams.delete("web");
  url.searchParams.set("download", "1");
  return url.toString();
}

export function normalizeVideoSource(value: string): VideoSource {
  const original = value.trim();
  if (!original) throw new Error("El video está vacío.");

  const iframeSrc = extractIframeSrc(original);
  const candidate = iframeSrc || original;

  const yt = youtubeId(candidate);
  if (yt) return { kind: "youtube", id: yt, original };

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Pegue una URL válida o un código <iframe> válido.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("El video debe usar una dirección http o https.");
  }

  if (isSharePointHost(url.hostname)) {
    return {
      kind: "direct",
      url: directMicrosoftVideoUrl(url.toString()),
      original,
      provider: "sharepoint",
    };
  }

  if (isOneDriveHost(url.hostname)) {
    return {
      kind: "direct",
      url: directMicrosoftVideoUrl(url.toString()),
      original,
      provider: "onedrive",
    };
  }

  if (iframeSrc) {
    return { kind: "iframe", url: url.toString(), original, provider: "external" };
  }

  return { kind: "direct", url: url.toString(), original, provider: "external" };
}

export function serializeVideoSource(source: VideoSource) {
  if (source.kind === "youtube") return `https://www.youtube.com/watch?v=${source.id}`;
  return source.url;
}

export function isMicrosoftVideoSource(value: string) {
  try {
    const source = normalizeVideoSource(value);
    return source.kind === "direct"
      && (source.provider === "sharepoint" || source.provider === "onedrive");
  } catch {
    return false;
  }
}
