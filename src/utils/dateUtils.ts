export interface DDayInfo {
  label: string;
  daysLeft: number | null;
  isOverdue: boolean;
  isToday: boolean;
  isSoon: boolean;
}

export function formatDDay(dueDate: string, referenceNow: Date = new Date()): DDayInfo {
  if (!dueDate) {
    return {
      label: '기한 없음',
      daysLeft: null,
      isOverdue: false,
      isToday: false,
      isSoon: false,
    };
  }

  const parsed = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: '기한 미정',
      daysLeft: null,
      isOverdue: false,
      isToday: false,
      isSoon: false,
    };
  }

  const today = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate()
  );
  const diffMs = parsed.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft === 0) {
    return {
      label: 'D-Day',
      daysLeft: 0,
      isOverdue: false,
      isToday: true,
      isSoon: true,
    };
  }

  if (daysLeft > 0) {
    return {
      label: `D-${daysLeft}`,
      daysLeft,
      isOverdue: false,
      isToday: false,
      isSoon: daysLeft <= 2,
    };
  }

  return {
    label: `D+${Math.abs(daysLeft)}`,
    daysLeft,
    isOverdue: true,
    isToday: false,
    isSoon: false,
  };
}

export function formatKoreanDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 ${hours}:${minutes}`;
}

export function formatRelativeKoreanTime(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function toLocalISODateOffset(daysOffset: number, base: Date = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
