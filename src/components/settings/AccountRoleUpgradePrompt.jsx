import { ArrowRight } from "lucide-react";
import GamerSettingsSection from "@/components/settings/GamerSettingsSection";
import { Button } from "@/components/ui/button";

export default function AccountRoleUpgradePrompt({
  title,
  description,
  icon,
  buttonLabel,
  buttonClassName,
  onClick,
}) {
  return (
    <GamerSettingsSection title={title} description={description} icon={icon}>
      <Button
        type="button"
        onClick={onClick}
        className={buttonClassName}
      >
        {buttonLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </GamerSettingsSection>
  );
}
