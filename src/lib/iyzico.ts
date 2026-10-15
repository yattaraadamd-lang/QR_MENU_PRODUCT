/**
 * iyzico Abonelik API istemcisi (IYZWSv2 kimlik doğrulama)
 *
 * Ortam değişkenleri:
 *   IYZICO_API_KEY, IYZICO_SECRET_KEY
 *   IYZICO_BASE_URL     — sandbox: https://sandbox-api.iyzipay.com, canlı: https://api.iyzipay.com
 *   IYZICO_MERCHANT_ID  — webhook imza doğrulaması için
 *
 * Güvenlik: Webhook ve callback gövdesine güvenilmez; abonelik durumu her zaman
 * iyzico API'sinden yeniden okunur.
 */

import crypto from "crypto";
import { SubscriptionStatus } from "@prisma/client";

const BASE_URL = process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";

export function isIyzicoConfigured() {
  return !!process.env.IYZICO_API_KEY && !!process.env.IYZICO_SECRET_KEY;
}

export class IyzicoError extends Error {
  constructor(message: string, public errorCode?: string) {
    super(message);
    this.name = "IyzicoError";
  }
}

async function iyzicoRequest<T = any>(method: "GET" | "POST", path: string, body?: object): Promise<T> {
  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) throw new IyzicoError("iyzico yapılandırılmamış");

  const bodyString = body ? JSON.stringify(body) : "";
  const randomKey = `${Date.now()}${crypto.randomBytes(6).toString("hex")}`;
  const uriPath = path.split("?")[0];
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(randomKey + uriPath + bodyString)
    .digest("hex");
  const authorization = Buffer.from(
    `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`
  ).toString("base64");

  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `IYZWSv2 ${authorization}`,
      "x-iyzi-rnd": randomKey,
    },
    body: body ? bodyString : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!json || json.status !== "success") {
    throw new IyzicoError(json?.errorMessage || `iyzico isteği başarısız (${res.status})`, json?.errorCode);
  }
  return json;
}

// ─── Ürün & Ödeme Planı (kurulum) ───────────────────────────────────────────

export async function createProduct(name: string, description?: string) {
  const res = await iyzicoRequest("POST", "/v2/subscription/products", {
    locale: "tr",
    conversationId: `product_${Date.now()}`,
    name,
    description,
  });
  return res.data.referenceCode as string;
}

export async function createPricingPlan(
  productReferenceCode: string,
  plan: { name: string; price: number }
) {
  const res = await iyzicoRequest("POST", `/v2/subscription/products/${productReferenceCode}/pricing-plans`, {
    locale: "tr",
    conversationId: `plan_${Date.now()}`,
    name: plan.name,
    price: plan.price,
    currencyCode: "TRY",
    paymentInterval: "MONTHLY",
    paymentIntervalCount: 1,
    planPaymentType: "RECURRING",
  });
  return res.data.referenceCode as string;
}

// ─── Abonelik Ödeme Formu ───────────────────────────────────────────────────

export interface IyzicoCustomer {
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  identityNumber: string;
  city: string;
  address: string;
}

export async function initializeSubscriptionCheckout(params: {
  pricingPlanReferenceCode: string;
  callbackUrl: string;
  conversationId: string;
  customer: IyzicoCustomer;
}) {
  const { customer } = params;
  const address = {
    contactName: `${customer.name} ${customer.surname}`,
    city: customer.city,
    country: "Turkey",
    address: customer.address,
  };

  const res = await iyzicoRequest("POST", "/v2/subscription/checkoutform/initialize", {
    locale: "tr",
    conversationId: params.conversationId,
    callbackUrl: params.callbackUrl,
    pricingPlanReferenceCode: params.pricingPlanReferenceCode,
    subscriptionInitialStatus: "ACTIVE",
    customer: {
      name: customer.name,
      surname: customer.surname,
      email: customer.email,
      gsmNumber: customer.gsmNumber,
      identityNumber: customer.identityNumber,
      billingAddress: address,
      shippingAddress: address,
    },
  });

  return {
    token: res.token as string,
    checkoutFormContent: res.checkoutFormContent as string,
    tokenExpireTime: res.tokenExpireTime as number,
  };
}

export interface IyzicoSubscription {
  referenceCode: string;
  customerReferenceCode: string;
  pricingPlanReferenceCode: string;
  subscriptionStatus: string;
  startDate?: number;
  endDate?: number;
}

export async function retrieveSubscriptionCheckout(token: string): Promise<IyzicoSubscription> {
  const res = await iyzicoRequest("GET", `/v2/subscription/checkoutform/${encodeURIComponent(token)}`);
  return res.data;
}

export async function getSubscription(referenceCode: string): Promise<IyzicoSubscription> {
  const res = await iyzicoRequest("GET", `/v2/subscription/subscriptions/${encodeURIComponent(referenceCode)}`);
  // Detay endpoint'i sayfalı liste döner
  return res.data?.items?.[0] ?? res.data;
}

export async function cancelSubscription(referenceCode: string) {
  await iyzicoRequest("POST", `/v2/subscription/subscriptions/${encodeURIComponent(referenceCode)}/cancel`, {
    locale: "tr",
    conversationId: `cancel_${Date.now()}`,
  });
}

export function mapIyzicoStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE";
    case "UNPAID":
    case "PENDING":
      return "PAST_DUE";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELED":
    case "UPGRADED":
    default:
      return "CANCELLED";
  }
}

// ─── Webhook ────────────────────────────────────────────────────────────────

/**
 * X-IYZ-SIGNATURE-V3 doğrulaması (abonelik bildirimleri).
 * İmza: HMAC-SHA256(secretKey, merchantId + secretKey + eventType + subscriptionReferenceCode + orderReferenceCode + customerReferenceCode)
 */
export function verifyWebhookSignature(
  signature: string | null,
  payload: {
    iyziEventType?: string;
    subscriptionReferenceCode?: string;
    orderReferenceCode?: string;
    customerReferenceCode?: string;
  }
) {
  const secretKey = process.env.IYZICO_SECRET_KEY;
  const merchantId = process.env.IYZICO_MERCHANT_ID;
  if (!signature || !secretKey || !merchantId) return false;

  const message =
    merchantId +
    secretKey +
    (payload.iyziEventType ?? "") +
    (payload.subscriptionReferenceCode ?? "") +
    (payload.orderReferenceCode ?? "") +
    (payload.customerReferenceCode ?? "");
  const expected = crypto.createHmac("sha256", secretKey).update(message).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Callback URL imzası (businessId'nin değiştirilmesini önler) ────────────

function callbackSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET tanımlı değil");
  return secret;
}

export function signCallbackState(businessId: string, planId: string) {
  const data = `${businessId}.${planId}`;
  const sig = crypto.createHmac("sha256", callbackSecret()).update(data).digest("hex");
  return `${data}.${sig}`;
}

export function verifyCallbackState(state: string | null) {
  if (!state) return null;
  const [businessId, planId, sig] = state.split(".");
  if (!businessId || !planId || !sig) return null;
  const expected = crypto.createHmac("sha256", callbackSecret()).update(`${businessId}.${planId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { businessId, planId };
}
