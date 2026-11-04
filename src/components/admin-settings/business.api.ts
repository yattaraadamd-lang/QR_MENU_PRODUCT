import { apiRequest } from "@/lib/api-client";
import type { BusinessDTO, BusinessFormValues, BusinessInput } from "./types";

export const BUSINESS_URL = "/api/admin/business";

/** useApiQuery `select`: uç `{ business: {...} }` döner */
export function selectBusiness(json: unknown): BusinessDTO | null {
  return (json as { business?: BusinessDTO } | null)?.business ?? null;
}

export function toFormValues(business: BusinessDTO): BusinessFormValues {
  return {
    name: business.name,
    description: business.description ?? "",
    phone: business.phone ?? "",
    email: business.email ?? "",
    address: business.address ?? "",
  };
}

export function toBusinessInput(values: BusinessFormValues): BusinessInput {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    address: values.address.trim() || null,
  };
}

export const businessApi = {
  update: (input: BusinessInput) =>
    apiRequest<{ business: BusinessDTO }>(BUSINESS_URL, {
      method: "PUT",
      body: input,
      fallbackError: "Ayarlar kaydedilemedi.",
    }),
};
