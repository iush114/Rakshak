export interface AIAnalysisRecord {
  id: string;
  cve: string;
  title: string;
  analyzedOn: string;
  riskScore: number;
  aiModel: string;
  explanation: string;
  potentialImpact: string;
  recommendedAction: string;
  riskSummary: string;
}

export const mockAIAnalysisHistory: AIAnalysisRecord[] = [];
