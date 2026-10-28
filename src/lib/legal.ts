// Terms/privacy versioning (MV-W01-08, 07 §10/§11). The version a user accepts is stored on
// profiles.terms_version and recorded as a `user.accepted_terms` domain event at onboarding and
// at sign-in (when the stored version differs).
//
// '1' = the terms in force today. The v2 drafts in docs/legal/*.md (credits, virtual items as
// licences, DPDP/PDPL wording, grievance contact) are NOT published — they go to counsel first;
// when they ship (W03 per 08), bump this to '2' and users re-accept on their next sign-in.
export const CURRENT_TERMS_VERSION = '1';
