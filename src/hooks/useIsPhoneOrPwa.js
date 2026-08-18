import { useEffect, useState } from "react";
import { isPhoneOrPwa } from "@/lib/deviceSurface";

export function useIsPhoneOrPwa() {
  const [phone, setPhone] = useState(() => isPhoneOrPwa());

  useEffect(() => {
    const update = () => setPhone(isPhoneOrPwa());
    update();
    const mql = window.matchMedia("(max-width: 767px)");
    const standalone = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener?.("change", update);
    standalone.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    return () => {
      mql.removeEventListener?.("change", update);
      standalone.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return phone;
}
