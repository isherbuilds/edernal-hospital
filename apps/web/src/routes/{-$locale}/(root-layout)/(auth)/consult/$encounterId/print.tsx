import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { generateAppSeo } from "@/shared/lib/seo";

import { PrescriptionPrintPage } from "@/features/consult";

import { appConfig } from "@/config/app.config";

const prescriptionPrintSearchSchema = z.object({
  prescriptionId: z.uuid().optional().catch(undefined)
});

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/consult/$encounterId/print")(
  {
    validateSearch: zodValidator(prescriptionPrintSearchSchema),
    head: ({ params }) =>
      generateAppSeo({
        alternates: {
          canonicalPath: `/consult/${params.encounterId}/print`,
          locale: params.locale
        },
        description: `Printable prescription in ${appConfig.site.shortName}.`,
        robots: {
          follow: false,
          index: false
        },
        title: "Prescription print"
      }),
    component: PrescriptionPrintRouteComponent
  }
);

function PrescriptionPrintRouteComponent() {
  const { prescriptionId } = Route.useSearch();

  return <PrescriptionPrintPage prescriptionId={prescriptionId} />;
}
