import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocation } from "@tsu-stack/i18n/tanstack-start/hooks/use-location";
import { stripLocalePrefix } from "@tsu-stack/i18n/tanstack-start/lib/strip-locale-prefix";
import { Button } from "@tsu-stack/ui/components/button";

export function NavbarUnauthenticatedButtons() {
  const location = useLocation();
  const redirect = stripLocalePrefix(location.href);

  return (
    <>
      <Button
        nativeButton={false}
        render={<Link to="/sign-in" search={{ redirect }} />}
        size="sm"
        variant="outline"
      >
        {m.navbar__sign_in()}
      </Button>
      <Button
        nativeButton={false}
        render={<Link to="/create-an-account" search={{ redirect }} />}
        size="sm"
      >
        {m.navbar__get_started()}
      </Button>
    </>
  );
}
