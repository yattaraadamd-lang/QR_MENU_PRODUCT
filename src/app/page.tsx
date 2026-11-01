import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import SignalStrip from "@/components/landing/SignalStrip";
import Transformation from "@/components/landing/Transformation";
import FeatureIndex from "@/components/landing/FeatureIndex";
import RoleDoors from "@/components/landing/RoleDoors";
import LandingFooter from "@/components/landing/LandingFooter";

/**
 * Landing — "Pikselden lezzete" kimliği. Sunucu bileşeni: istemciye yalnız demo
 * penceresi (DemoButton) ve kaydırınca belirme (motion.tsx) iner.
 */
export default function HomePage() {
  return (
    <div className="landing-theme min-h-viewport overflow-x-hidden">
      <LandingNav />
      <main id="main-content">
        <Hero />
        <SignalStrip />
        <Transformation />
        <FeatureIndex />
        <RoleDoors />
      </main>
      <LandingFooter />
    </div>
  );
}
