"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRecord, type ApiResult } from "@/lib/api-client";

/** Alan hataları varken formun genelinde (FormError) gösterilen özet */
export const FIELDS_INVALID = "İşaretli alanları düzeltip yeniden deneyin.";

/**
 * Hata yanıtındaki alan → mesaj eşlemesi (contracts/errors.ts `fieldErrors`). Yanıt güvenilir
 * sayılmaz: yalnız metin değerler alınır, yoksa boş nesne döner.
 */
export function readFieldErrors(result: ApiResult<unknown>): Readonly<Record<string, string>> {
  const raw = result.ok ? null : result.body?.fieldErrors;
  if (!isRecord(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Yanıttaki alan hatalarından formun gösterebildikleri (`names`); diğerleri özet mesajda kalır */
export function pickFieldErrors(result: ApiResult<unknown>, names: readonly string[]): Readonly<Record<string, string>> {
  const all = readFieldErrors(result);
  return Object.fromEntries(names.filter((name) => typeof all[name] === "string").map((name) => [name, all[name]]));
}

/**
 * Sunucunun alan hatalarını form alanlarına dağıtır (FE-ARCH-3.4). Alanlar `Field`'ın `error`
 * prop'u ve `invalidProps` ile bağlanır; hata gelince odak ilk geçersiz alana taşınır, ekran
 * okuyucu etiketi ve hatayı birlikte okur.
 *
 * `names`: formun hata gösterebildiği alanlar (istek gövdesindeki adlarıyla), modül düzeyinde
 * sabit bir dizi. Sunucu başka bir alan için hata dönerse `capture` false verir ve form sunucunun
 * özet mesajını gösterir: "işaretli alanları düzeltin" deyip hiçbir alanı işaretlememiş olmaz.
 *
 *   const FIELDS = ["name", "icon"] as const;
 *   const fields = useFieldErrors(FIELDS);
 *   const result = await save.run(...);
 *   if (!result.ok && fields.capture(result)) save.setError(FIELDS_INVALID);
 *   <form ref={fields.formRef}> … <Field error={fields.error("name")}> …
 */
export function useFieldErrors<K extends string>(names: readonly K[]) {
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirst = useRef(false);

  // aria-invalid çizildikten sonra: ilk geçersiz alan
  useEffect(() => {
    if (!focusFirst.current) return;
    focusFirst.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  /** Yanıttan formun gösterebildiği alan hatalarını alır (başarıda temizler); varsa true */
  const capture = useCallback(
    (result: ApiResult<unknown>): boolean => {
      const next = pickFieldErrors(result, names);
      const found = Object.keys(next).length > 0;
      focusFirst.current = found;
      setErrors(next);
      return found;
    },
    [names],
  );

  /** Kullanıcı alanı düzeltmeye başlayınca o alanın hatası kalkar (hatası olmayan alanda etkisiz) */
  const clear = useCallback((field: string) => {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Alanın hatası; yoksa undefined */
  const error = (field: K): string | undefined => errors[field];

  return { error, formRef, capture, clear };
}
