"use client";

/**
 * Sayfanın ilk odaklanabilir öğesi: klavye kullanıcısı menüleri atlayıp
 * doğrudan içeriğe geçer. Hedef #main-content; yoksa ilk <main>, o da yoksa
 * ilk <h1>.
 */
export default function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target =
      document.getElementById("main-content") ??
      document.querySelector<HTMLElement>("main") ??
      document.querySelector<HTMLElement>("h1");
    if (!target) return;
    e.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView({ block: "start" });
  };

  return (
    <a href="#main-content" className="skip-link sr-only-focusable" onClick={handleClick}>
      Ana içeriğe geç
    </a>
  );
}
