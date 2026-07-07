import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { FormularyAdminPage } from "@/features/formulary-admin";

import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/admin/formulary/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: {
        canonicalPath: "/admin/formulary",
        locale: params.locale
      },
      description: `Manage hospital formulary items in ${appConfig.site.shortName}.`,
      robots: {
        follow: false,
        index: false
      },
      title: "Formulary admin"
    }),
  component: FormularyAdminPage
});
