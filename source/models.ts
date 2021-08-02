
export interface CallDocModel {
    offer: SessionModel
    offer_candidates: CandidateModel[]
    on_answer: (a: SessionModel) => void
    on_offer_candidate: (a: CandidateModel) => void
    on_answer_candidate: (a: CandidateModel) => void
    answered: boolean
}
export type CandidateModel = any
export type SessionModel = any
