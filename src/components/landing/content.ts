import { BellRing, ConciergeBell, Monitor, QrCode, ShoppingBag, Smartphone, TrendingUp, type LucideIcon } from "lucide-react";

/** Landing metinleri ve sabit örnek verisi: bileşenler yalnız düzeni taşır */

export interface HeroFact {
  readonly label: string;
  readonly value: string;
}

export const HERO_FACTS: readonly HeroFact[] = [
  { label: "Kurulum", value: "5 dk" },
  { label: "İndirilecek uygulama", value: "0" },
  { label: "Sipariş iletimi", value: "Canlı" },
];

export interface MenuPreviewItem {
  readonly name: string;
  readonly note: string;
  readonly price: string;
}

export const MENU_PREVIEW: readonly MenuPreviewItem[] = [
  { name: "Közde patlıcan", note: "Yoğurt, közlenmiş biber", price: "185" },
  { name: "Kuzu tandır", note: "Fırın patates, kekik", price: "420" },
  { name: "Fırın sütlaç", note: "Tarçın, fındık", price: "110" },
];

export type FeedStatus = "new" | "payment" | "ready";

export interface FeedEntry {
  readonly time: string;
  readonly table: string;
  readonly text: string;
  readonly status: FeedStatus;
}

export const FEED_STATUS_LABEL: Readonly<Record<FeedStatus, string>> = {
  new: "Yeni",
  payment: "Ödeme",
  ready: "Hazır",
};

export const LIVE_FEED: readonly FeedEntry[] = [
  { time: "19:42:07", table: "Masa 05", text: "2× Közde patlıcan", status: "new" },
  { time: "19:41:52", table: "Masa 02", text: "Hesap istendi", status: "payment" },
  { time: "19:41:30", table: "Masa 09", text: "3× Türk kahvesi", status: "ready" },
];

export interface TransformStep {
  readonly code: string;
  readonly from: string;
  readonly to: string;
  readonly desc: string;
  readonly icon: LucideIcon;
}

export const TRANSFORM_STEPS: readonly TransformStep[] = [
  { code: "1", from: "QR", to: "Menü", icon: QrCode, desc: "Misafir masadaki QR'ı okutur; uygulama indirmeden fotoğraflı menü açılır." },
  { code: "2", from: "Sepet", to: "Sipariş", icon: ShoppingBag, desc: "Sepetini kendisi kurar ve gönderir. Sipariş garsonun ekranına saniyesinde düşer." },
  { code: "3", from: "Çağrı", to: "Servis", icon: BellRing, desc: "Garson çağrısı, hesap isteği, mutfak durumu: hepsi tek ve canlı bir akışta." },
  { code: "4", from: "Hesap", to: "Ciro", icon: TrendingUp, desc: "Ciro, masa ve ürün performansı tek panelde. Gün sonunu beklemeden görürsünüz." },
];

export interface Feature {
  readonly code: string;
  readonly title: string;
  readonly desc: string;
}

export const FEATURES: readonly Feature[] = [
  { code: "F/01", title: "QR menü", desc: "Masaya özel kod; menü uygulamasız, saniyesinde açılır." },
  { code: "F/02", title: "Masadan sipariş", desc: "Misafir sepetini kendisi kurar, sipariş doğrudan iletilir." },
  { code: "F/03", title: "Garson ekranı", desc: "Yeni sipariş, çağrı ve hesap isteği sesli ve canlı gelir." },
  { code: "F/04", title: "Masa haritası", desc: "Hangi masa dolu, hangisi hesap bekliyor: tek bakışta." },
  { code: "F/05", title: "Ödeme takibi", desc: "Hesap açma, bölme, kapama ve onay akışı." },
  { code: "F/06", title: "Ciro raporu", desc: "Günlük ve aylık gelir, en çok satan ürünler." },
  { code: "F/07", title: "Ürün ve stok", desc: "Kategori, fiyat ve tükendi bilgisi anında menüde." },
  { code: "F/08", title: "Ekip yönetimi", desc: "Garson davetleri ve role göre erişim." },
];

export interface DemoRole {
  readonly code: string;
  readonly role: string;
  readonly title: string;
  readonly desc: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** /demo veritabanından masa seçen bir yönlendirme: her ziyarette ön yüklenmesin */
  readonly prefetch?: false;
}

export const DEMO_ROLES: readonly DemoRole[] = [
  {
    code: "R/01",
    role: "Misafir",
    title: "Menüyü masadan açın",
    desc: "QR menüyü görün, sepete ekleyin, siparişi gönderin.",
    href: "/demo",
    icon: Smartphone,
    prefetch: false,
  },
  {
    code: "R/02",
    role: "Garson",
    title: "Siparişleri canlı yönetin",
    desc: "Gelen siparişler, masa durumları ve ödeme talepleri.",
    href: "/auth/signin?demo=waiter",
    icon: ConciergeBell,
  },
  {
    code: "R/03",
    role: "Yönetici",
    title: "İşletmeyi tek panelden görün",
    desc: "Ciro, ürün, masa, kategori ve ekip yönetimi.",
    href: "/auth/signin?demo=admin",
    icon: Monitor,
  },
];
