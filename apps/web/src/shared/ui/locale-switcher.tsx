import { Check, Languages } from "lucide-react";
import { type ComponentProps } from "react";

import { m } from "@tsu-stack/i18n/messages";
import { locales } from "@tsu-stack/i18n/runtime";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Button } from "@tsu-stack/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@tsu-stack/ui/components/dropdown-menu";
import { cn } from "@tsu-stack/ui/lib/utils";

type LocaleSwitcherProps = {
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
};

export function LocaleSwitcher({
  size = "icon",
  variant = "ghost",
  className
}: LocaleSwitcherProps) {
  const { locale: currentLocale, switchLocale } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Switch language"
            className={className}
            size={size}
            variant={variant}
          />
        }
      >
        <Languages aria-hidden="true" size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => {
          const isActive = locale === currentLocale;
          return (
            <DropdownMenuItem
              key={locale}
              className={cn("cursor-pointer gap-2", isActive && "bg-accent")}
              onClick={() => switchLocale(locale)}
            >
              <span className="flex-1">{m.language_name(undefined, { locale })}</span>
              {isActive && <Check aria-hidden="true" className="opacity-60" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
