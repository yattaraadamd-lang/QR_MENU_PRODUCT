/**
 * Personel bildirimleri (FE-ARCH-3.2): özelliğin dışa açık yüzü. Kabuklar sağlayıcıyı ve paneli
 * yalnız buradan alır; içerideki iki katmana derin import lint'te yasak.
 *   - model/: bağlam ve hook'lar, ses (autoplay kilidi, yedek bip), soket olayı → bildirim
 *   - ui/: zil, ses düğmesi, toast, çekmece ve bunları birleştiren panel
 */

export {
  NotificationSoundProvider,
  useNotificationActions,
  useNotificationList,
  useNotificationSoundState,
} from "./model/NotificationSoundContext";
export type { NotificationItem, NotificationSoundMode } from "./model/types";
export { NotificationPanel } from "./ui/NotificationPanel";
