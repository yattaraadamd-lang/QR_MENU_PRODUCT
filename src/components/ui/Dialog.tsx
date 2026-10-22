"use client";

import React, { useId, useLayoutEffect, useRef } from "react";

interface DialogProps {
  onClose: () => void;
  children: React.ReactNode;
  /** false iken hiçbir şey çizilmez; verilmezse bileşen takıldığı an açıktır. */
  open?: boolean;
  /** İçerik kutusunun sınıfı (varsayılan: "modal-content"). */
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  overlayClassName?: string;
  overlayStyle?: React.CSSProperties;
  /** Görünür başlık yoksa ekran okuyucuya okunacak ad. */
  "aria-label"?: string;
}

/**
 * Yerel <dialog> üzerine kurulu modal. showModal() sayfanın geri kalanını
 * etkisiz (inert) yapar, böylece odak pencerede kalır; Esc ve arka plana
 * tıklama onClose'u çağırır; kapanınca odak pencereyi açan öğeye döner.
 * İçerideki ilk başlık otomatik olarak pencerenin adı olur. Açılışta
 * odaklanması gereken alan `data-autofocus` ile işaretlenir.
 */
export default function Dialog({ open = true, ...props }: DialogProps) {
  if (!open) return null;
  return <OpenDialog {...props} />;
}

function OpenDialog({
  onClose,
  children,
  contentClassName = "modal-content",
  contentStyle,
  overlayClassName = "",
  overlayStyle,
  "aria-label": ariaLabel,
}: Omit<DialogProps, "open">) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const headingId = useId();

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const trigger = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!ariaLabel) {
      const heading = dialog.querySelector<HTMLElement>("h1, h2, h3, h4");
      if (heading) {
        heading.id ||= headingId;
        dialog.setAttribute("aria-labelledby", heading.id);
      }
    }

    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    // Kapanmayı her zaman React durumu yönetir (çıkış animasyonu, "işlem
    // sürüyor" kilidi). Esc keydown'da yakalanır: varsayılanı engellenince
    // tarayıcı kapatma isteği (cancel/close) hiç üretmez.
    let disposed = false;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onCloseRef.current();
    };
    // Yedek: başka kaynaklı kapatma istekleri (ör. Android geri tuşu).
    // Chrome bunları bazen iptal edilemez yapar; o zaman pencere tarayıcıca
    // kapanır ve close yakalanır.
    const handleCancel = (e: Event) => {
      if (!e.cancelable) return;
      e.preventDefault();
      onCloseRef.current();
    };
    const handleNativeClose = () => {
      // close olayı kuyruktan geç gelir: önceki bir efektin close()'u (StrictMode
      // çift çalıştırma) yeniden açılmış pencereye ulaşabilir — açıksa yok say.
      if (disposed || dialog.open) return;
      onCloseRef.current();
      // onClose kapatmayı reddettiyse (ör. işlem sürüyor) pencere açık kalmalı
      setTimeout(() => {
        if (!disposed && dialog.isConnected && !dialog.open) dialog.showModal();
      }, 50);
    };
    // Yalnız basma ve bırakma ikisi de arka planda olduğunda kapat:
    // içerikte metin seçip fareyi dışarıda bırakmak pencereyi kapatmasın.
    let pressedOnBackdrop = false;
    const handlePointerDown = (e: PointerEvent) => {
      pressedOnBackdrop = e.target === dialog;
    };
    const handleClick = (e: MouseEvent) => {
      if (pressedOnBackdrop && e.target === dialog) onCloseRef.current();
      pressedOnBackdrop = false;
    };

    dialog.addEventListener("keydown", handleKeyDown);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleNativeClose);
    dialog.addEventListener("pointerdown", handlePointerDown);
    dialog.addEventListener("click", handleClick);
    return () => {
      disposed = true;
      dialog.removeEventListener("keydown", handleKeyDown);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleNativeClose);
      dialog.removeEventListener("pointerdown", handlePointerDown);
      dialog.removeEventListener("click", handleClick);
      if (dialog.open) dialog.close();
      document.body.style.overflow = prevOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [ariaLabel, headingId]);

  return (
    <dialog
      ref={ref}
      className={`modal-overlay ${overlayClassName}`.trim()}
      style={overlayStyle}
      aria-label={ariaLabel}
    >
      <div className={contentClassName} style={contentStyle}>
        {children}
      </div>
    </dialog>
  );
}
