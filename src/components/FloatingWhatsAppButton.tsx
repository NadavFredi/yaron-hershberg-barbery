import { useCallback } from "react";
import { SiWhatsapp } from "react-icons/si";

const WHATSAPP_NUMBER = "972537729145";
const WHATSAPP_MESSAGE = "היי, אשמח לשמוע פרטים נוספים";

export const FloatingWhatsAppButton = () => {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_MESSAGE,
  )}`;

  const copyToClipboard = useCallback(async () => {
    console.info("[FloatingWhatsAppButton] Attempting to copy message to clipboard", {
      messageLength: WHATSAPP_MESSAGE.length,
    });

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(WHATSAPP_MESSAGE);
        console.info("[FloatingWhatsAppButton] Message copied via navigator.clipboard");
        return;
      }
      throw new Error("Navigator clipboard API unavailable");
    } catch (clipboardError) {
      console.warn(
        "[FloatingWhatsAppButton] navigator.clipboard failed, attempting execCommand fallback",
        clipboardError,
      );

      try {
        const textArea = document.createElement("textarea");
        textArea.value = WHATSAPP_MESSAGE;
        textArea.style.position = "fixed";
        textArea.style.top = "-1000px";
        textArea.style.right = "-1000px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const fallbackSuccess = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (!fallbackSuccess) {
          throw new Error("document.execCommand copy failed");
        }

        console.info("[FloatingWhatsAppButton] Message copied via execCommand fallback");
      } catch (fallbackError) {
        console.error("[FloatingWhatsAppButton] Failed to copy message to clipboard", fallbackError);
      }
    }
  }, []);

  const handleClick = useCallback(async () => {
    console.info("[FloatingWhatsAppButton] Click detected, preparing WhatsApp conversation", {
      whatsappUrl,
      number: WHATSAPP_NUMBER,
    });

    await copyToClipboard();

    const newWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    if (!newWindow) {
      console.warn("[FloatingWhatsAppButton] window.open returned null, possibly blocked by popup settings");
    } else {
      console.info("[FloatingWhatsAppButton] WhatsApp window opened successfully");
    }
  }, [copyToClipboard, whatsappUrl]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition hover:bg-green-600 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
      aria-label="פתח שיחת וואטסאפ"
      title="פתח שיחת וואטסאפ"
      dir="rtl"
    >
      <SiWhatsapp className="h-7 w-7" aria-hidden="true" />
      <span className="sr-only">פתח שיחת וואטסאפ</span>
    </button>
  );
};

export default FloatingWhatsAppButton;

