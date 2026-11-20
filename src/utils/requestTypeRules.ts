import type {
  CustomFieldDefinition,
  InboxTab,
  RequestTypeColor,
  RequestTypeIconName,
} from '../types/models';

export interface RequestTypeInput {
  name: string;
  description?: string;
  icon: RequestTypeIconName;
  color: RequestTypeColor;
  defaultAssigneeIds: string[];
  fields: CustomFieldDefinition[];
}

export function validateRequestTypeInput(
  input: RequestTypeInput
): { valid: boolean; error?: string } {
  if (!input.name.trim()) {
    return { valid: false, error: '요청 유형 이름을 입력해 주세요.' };
  }

  for (let i = 0; i < input.fields.length; i++) {
    const f = input.fields[i];
    if (!f.label.trim()) {
      return {
        valid: false,
        error: `${i + 1}번째 양식 항목의 이름을 입력해 주세요.`,
      };
    }
    if (f.type === 'select') {
      const validOpts = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (validOpts.length === 0) {
        return {
          valid: false,
          error: `"${f.label}" 단일 선택 항목에는 최소 1개의 선택지를 입력해 주세요.`,
        };
      }
    }
  }

  return { valid: true };
}

export function moveFieldItem(
  fields: CustomFieldDefinition[],
  index: number,
  direction: 'up' | 'down'
): CustomFieldDefinition[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= fields.length || target < 0 || target >= fields.length) {
    return fields;
  }
  const next = [...fields];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function pickDefaultInboxTab(
  counts: Record<InboxTab, number>,
  preferred: InboxTab = 'received'
): InboxTab {
  if (preferred !== 'all' && counts[preferred] > 0) {
    return preferred;
  }
  if (counts.received > 0) return 'received';
  if (counts.sent > 0) return 'sent';
  if (counts.cc > 0) return 'cc';
  return preferred === 'all' ? 'received' : preferred;
}
