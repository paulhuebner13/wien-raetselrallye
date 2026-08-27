export type MusicAnswerState = {
  answers: string[];
  stages: number[];
};

export function parseMusicAnswer(raw: string | undefined | null, count: number): MusicAnswerState {
  try {
    const data = JSON.parse(raw ?? '');
    if (Array.isArray(data)) {
      return {
        answers: Array.from({ length: count }, (_, i) => String(data[i] ?? '')),
        stages: Array(count).fill(1),
      };
    }
    if (data && typeof data === 'object') {
      const object = data as { answers?: unknown[]; stages?: unknown[] };
      return {
        answers: Array.from({ length: count }, (_, i) => String(object.answers?.[i] ?? '')),
        stages: Array.from({ length: count }, (_, i) => Math.min(4, Math.max(1, Math.round(Number(object.stages?.[i] ?? 1)) || 1))),
      };
    }
  } catch {}
  return { answers: Array(count).fill(''), stages: Array(count).fill(1) };
}

export function serializeMusicAnswer(state: MusicAnswerState) {
  return JSON.stringify({ answers: state.answers, stages: state.stages });
}
