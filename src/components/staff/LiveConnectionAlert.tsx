"use client";

import { useSyncExternalStore } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { SOCKET_AUTH_FAILED_EVENT, SOCKET_STATUS_EVENT } from "@/lib/socket-client";

/**
 * Canlı bağlantı kimlik hatasıyla düşünce (oturum iptali, belirteç yenilenemedi) soket yeniden
 * bağlanmaz: yeni sipariş ve çağrı bildirimi gelmez, listeler yalnız yoklamayla gecikerek
 * yenilenir. Personel bunu sessizce kaybetmesin diye kabuk duyurur (FE-ARCH-3.9b); bağlantı
 * yeniden kurulursa (başka ekran geçerli belirteçle abone olduysa) uyarı kalkar. Durum modül
 * düzeyinde: admin ve garson kabuğu arasında geçince kaybolmaz.
 */
let connectionLost = false;

function subscribe(onChange: () => void) {
  const onAuthFailed = () => {
    connectionLost = true;
    onChange();
  };
  const onStatus = (event: Event) => {
    if (!connectionLost || !isConnectedEvent(event)) return;
    connectionLost = false;
    onChange();
  };
  window.addEventListener(SOCKET_AUTH_FAILED_EVENT, onAuthFailed);
  window.addEventListener(SOCKET_STATUS_EVENT, onStatus);
  return () => {
    window.removeEventListener(SOCKET_AUTH_FAILED_EVENT, onAuthFailed);
    window.removeEventListener(SOCKET_STATUS_EVENT, onStatus);
  };
}

function isConnectedEvent(event: Event): boolean {
  const detail: unknown = event instanceof CustomEvent ? event.detail : null;
  return typeof detail === "object" && detail !== null && "connected" in detail && detail.connected === true;
}

const getSnapshot = () => connectionLost;
const getServerSnapshot = () => false;

/** `className`: kabuğun içerik boşluğuyla hizalayan dış kutu */
export default function LiveConnectionAlert({ className }: { className?: string }) {
  const lost = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!lost) return null;
  return (
    <div className={className}>
      <Alert
        tone="danger"
        role="alert"
        className="font-semibold"
        action={
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Sayfayı yenile
          </Button>
        }
      >
        Canlı bağlantı kesildi: yeni sipariş ve çağrılar anlık gelmiyor.
      </Alert>
    </div>
  );
}
