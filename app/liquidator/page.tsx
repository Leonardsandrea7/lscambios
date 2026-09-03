import ProviderWidget from "@/components/ProviderWidget";

/**
 * Esta página es solo el "marco" — todo el panel real vive en el widget,
 * para que sea fácil de reusar o incrustar en otro lugar si hace falta.
 */
export default function LiquidatorPage() {
  return <ProviderWidget />;
}
