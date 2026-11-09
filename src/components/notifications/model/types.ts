export type NotificationType =
  | "new_order"
  | "call_waiter"
  | "payment_request"
  | "help_request"
  | "service_request"
  | "order_request_update";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  icon: string;
  title: string;
  message: string;
  tableNumber?: string;
  tableName?: string;
  createdAt: Date;
  /** true → kritik bildirim, toast elle kapatılana kadar ekranda kalır */
  persistent?: boolean;
};

/** waiter → ses varsayılan açık; admin → ses varsayılan kapalı, sadece önemli olaylar */
export type NotificationSoundMode = "waiter" | "admin";
