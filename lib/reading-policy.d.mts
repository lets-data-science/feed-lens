export type ReadingAnswers = { relevance:{noul:number}; usefulness:{noul:number}; bait:{noul:number} };
export const READING_DEFAULTS: {goal:string;criteria:string;minRelevance:number;minUsefulness:number;maxBait:number};
export function decideReading(answers:ReadingAnswers,preferences?:Partial<typeof READING_DEFAULTS>):{verdict:'read'|'skip'|'unsure';label:string;score:number;reason:string};
