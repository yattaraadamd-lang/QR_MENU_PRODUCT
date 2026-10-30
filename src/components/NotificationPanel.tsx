"use client";

import { useCallback, useState } from "react";
import { useNotificationActions } from "@/contexts/NotificationSoundContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationDrawer from "@/components/notifications/NotificationDrawer";
import NotificationToast from "@/components/notifications/NotificationToast";
import SoundToggle from "@/components/notifications/SoundToggle";

/**
 * 🔔 Personel bildirim alanı (garson ve admin üst çubuğu): zil, ses düğmesi, son
 * bildirimin toast'ı ve sağdan açılan çekmece. Parçalar components/notifications altında;
 * her biri yalnız ihtiyacı olan bağlamı okur (bildirim gelince ses düğmesi, ses tercihi
 * değişince zil çizilmez). Bu kabuk yalnız kararlı eylem bağlamını okur.
 */
export function NotificationPanel() {
  const { markAllRead } = useNotificationActions();
  const [isOpen, setIsOpen] = useState(false);

  // Panel modal: açıkken zil etkisiz, yalnız açar. markAllRead state güncelleyicisinin
  // dışında: içeride çağrılınca React "render sırasında başka bileşeni güncelleme" uyarısı veriyordu
  const openPanel = useCallback(() => {
    markAllRead();
    setIsOpen(true);
  }, [markAllRead]);

  const closePanel = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <NotificationBell onClick={openPanel} />
      {/* Ses kontrolü — açık/kapalı tercihi + tarayıcı kilidi durumu */}
      <SoundToggle />
      {/* Kritik bildirimler elle kapatılana kadar kalır */}
      <NotificationToast />
      <NotificationDrawer open={isOpen} onClose={closePanel} />
    </>
  );
}

export default NotificationPanel;
