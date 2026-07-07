export { ConsultPage } from "./ui/consult-page";
export { PrescriptionPrintPage } from "./ui/prescription-print-page";

export {
  consultWorkspaceQueryKeys,
  getConsultWorkspaceQueryOptions,
  useGetConsultWorkspaceQuery,
  type ConsultWorkspaceQueryInput,
  type ConsultWorkspaceQueryResult
} from "./api/get-consult-workspace.query";
export {
  getPrescriptionPrintQueryOptions,
  prescriptionPrintQueryKeys,
  useGetPrescriptionPrintQuery,
  type PrescriptionPrintQueryInput,
  type PrescriptionPrintQueryResult
} from "./api/get-prescription-print.query";
export {
  listNoteTemplatesQueryOptions,
  noteTemplatesQueryKeys,
  useListNoteTemplatesQuery,
  type NoteTemplatesQueryResult
} from "./api/list-note-templates.query";
export {
  formularySearchQueryKeys,
  searchFormularyQueryOptions,
  useSearchFormularyQuery,
  type FormularySearchQueryInput,
  type FormularySearchQueryResult
} from "./api/search-formulary.query";
export {
  useSaveConsultNoteMutation,
  type SaveConsultNoteMutationResult
} from "./api/save-consult-note.mutation";
export {
  useSignConsultNoteMutation,
  type SignConsultNoteMutationResult
} from "./api/sign-consult-note.mutation";
export {
  useSupersedeConsultNoteMutation,
  type SupersedeConsultNoteMutationResult
} from "./api/supersede-consult-note.mutation";
export {
  useSavePrescriptionMutation,
  type SavePrescriptionMutationResult
} from "./api/save-prescription.mutation";
export {
  useSignPrescriptionMutation,
  type SignPrescriptionMutationResult
} from "./api/sign-prescription.mutation";
export {
  useSupersedePrescriptionMutation,
  type SupersedePrescriptionMutationResult
} from "./api/supersede-prescription.mutation";
export {
  useUpdatePatientAllergiesMutation,
  type UpdatePatientAllergiesMutationResult
} from "./api/update-patient-allergies.mutation";
