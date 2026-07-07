import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { NoteTemplateAdminPage } from "@/features/note-template-admin";

import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/admin/note-templates/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: {
        canonicalPath: "/admin/note-templates",
        locale: params.locale
      },
      description: `Manage hospital note templates in ${appConfig.site.shortName}.`,
      robots: {
        follow: false,
        index: false
      },
      title: "Note templates admin"
    }),
  component: NoteTemplateAdminPage
});
