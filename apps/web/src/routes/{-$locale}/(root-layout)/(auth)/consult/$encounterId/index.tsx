import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { ConsultPage } from "@/features/consult";

import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/consult/$encounterId/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: {
        canonicalPath: `/consult/${params.encounterId}`,
        locale: params.locale
      },
      description: `Doctor consult workspace in ${appConfig.site.shortName}.`,
      robots: {
        follow: false,
        index: false
      },
      title: "Consult workspace"
    }),
  component: ConsultRouteComponent
});

function ConsultRouteComponent() {
  const { encounterId } = Route.useParams();

  return <ConsultPage encounterId={encounterId} />;
}
