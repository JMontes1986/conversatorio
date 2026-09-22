export type NetworkProfile = {
  lowBandwidth: boolean;
  saveData: boolean;
  effectiveType: string | null;
};

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function connection(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

export function getNetworkProfile(): NetworkProfile {
  const info = connection();
  const effectiveType = info?.effectiveType || null;
  const saveData = info?.saveData === true;
  const lowBandwidth = saveData
    || effectiveType === "slow-2g"
    || effectiveType === "2g";

  return { lowBandwidth, saveData, effectiveType };
}

export function subscribeToNetworkProfile(callback: (profile: NetworkProfile) => void) {
  const info = connection();
  const emit = () => callback(getNetworkProfile());

  emit();
  info?.addEventListener?.("change", emit);
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);

  return () => {
    info?.removeEventListener?.("change", emit);
    window.removeEventListener("online", emit);
    window.removeEventListener("offline", emit);
  };
}

export function reconciliationIntervalMs(realtimeConnected: boolean) {
  const { lowBandwidth } = getNetworkProfile();

  if (realtimeConnected) {
    return lowBandwidth ? 300_000 : 120_000;
  }

  return lowBandwidth ? 60_000 : 30_000;
}

export function judgeOutcomePollMs() {
  return getNetworkProfile().lowBandwidth ? 20_000 : 10_000;
}
