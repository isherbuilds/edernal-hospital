import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { FrontDeskPage } from "@/features/front-desk/front-desk-page";

import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/front-desk/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: {
        canonicalPath: "/front-desk",
        locale: params.locale
      },
      description: `Front desk registration and queue workflow in ${appConfig.site.shortName}.`,
      robots: {
        follow: false,
        index: false
      },
      title: "Front desk"
    }),
  component: FrontDeskPage
});
