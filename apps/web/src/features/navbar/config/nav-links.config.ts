import { ENV_WEB_ISOMORPHIC } from "@tsu-stack/env/web/env.isomorphic";
import { m } from "@tsu-stack/i18n/messages";
import { type LinkProps } from "@tsu-stack/i18n/tanstack-start/components/link";

type NavbarLink =
  | { label: () => string; href: LinkProps["href"]; to?: never }
  | { label: () => string; href?: never; to: LinkProps["to"] };

export const navLinks: NavbarLink[] = [
  {
    label: () => m.navbar__playground(),
    to: "/playground"
  },
  {
    label: () => m.navbar__dashboard(),
    to: "/dashboard"
  },
  {
    label: () => m.navbar__front_desk(),
    to: "/front-desk"
  },
  {
    label: () => m.navbar__formulary(),
    to: "/admin/formulary"
  },
  {
    label: () => m.navbar__note_templates(),
    to: "/admin/note-templates"
  },
  {
    href: `${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL}/docs`,
    label: () => m.navbar__api_docs()
  }
];
