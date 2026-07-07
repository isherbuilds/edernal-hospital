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
  saveConsultNoteMutationOptions,
  useSaveConsultNoteMutation,
  type SaveConsultNoteMutationResult
} from "./api/save-consult-note.mutation";
export {
  signConsultNoteMutationOptions,
  useSignConsultNoteMutation,
  type SignConsultNoteMutationResult
} from "./api/sign-consult-note.mutation";
export {
  supersedeConsultNoteMutationOptions,
  useSupersedeConsultNoteMutation,
  type SupersedeConsultNoteMutationResult
} from "./api/supersede-consult-note.mutation";
export {
  savePrescriptionMutationOptions,
  useSavePrescriptionMutation,
  type SavePrescriptionMutationResult
} from "./api/save-prescription.mutation";
export {
  signPrescriptionMutationOptions,
  useSignPrescriptionMutation,
  type SignPrescriptionMutationResult
} from "./api/sign-prescription.mutation";
export {
  supersedePrescriptionMutationOptions,
  useSupersedePrescriptionMutation,
  type SupersedePrescriptionMutationResult
} from "./api/supersede-prescription.mutation";
export {
  updatePatientAllergiesMutationOptions,
  useUpdatePatientAllergiesMutation,
  type UpdatePatientAllergiesMutationResult
} from "./api/update-patient-allergies.mutation";
