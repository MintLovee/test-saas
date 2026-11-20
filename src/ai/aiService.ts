import type { Request, RequestType } from '../types/models';

/**
 * TODO: 추후 Gemini API를 연동하여 요청 분류, 월간 요약, 후속 조치 제안을 구현할 서비스 모듈입니다.
 * 현재 단계에서는 UI와 연결하지 않고 인터페이스와 빈 함수만 정의합니다.
 */

export interface RequestClassificationResult {
  suggestedTypeId: string | null;
  confidence: number;
  reason?: string;
}

export interface MonthlySummaryResult {
  totalCount: number;
  highlights: string[];
}

export interface FollowUpSuggestion {
  suggestions: string[];
}

export async function classifyRequest(
  _title: string,
  _content: string,
  _availableTypes: RequestType[]
): Promise<RequestClassificationResult> {
  // TODO: Gemini API 연동 후 요청 제목과 본문을 바탕으로 적절한 RequestType을 추천하도록 구현
  return {
    suggestedTypeId: null,
    confidence: 0,
  };
}

export async function summarizeMonth(
  _requests: Request[],
  _yearMonth: string
): Promise<MonthlySummaryResult> {
  // TODO: Gemini API 연동 후 해당 월의 팀 요청 내역을 카테고리/상태별로 요약하도록 구현
  return {
    totalCount: 0,
    highlights: [],
  };
}

export async function suggestFollowUp(
  _request: Request
): Promise<FollowUpSuggestion> {
  // TODO: Gemini API 연동 후 현재 요청 상태와 댓글 문맥에 맞는 후속 응답/조치를 제안하도록 구현
  return {
    suggestions: [],
  };
}
