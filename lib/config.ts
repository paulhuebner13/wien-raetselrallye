import stationsRaw from '@/config/stations.json';
import questionsRaw from '@/config/questions.json';
import scoringRaw from '@/config/scoring.json';
import type { QuestionBlock, RallyeConfig, ScoringConfig } from './types';

export const rallyeConfig = stationsRaw as RallyeConfig;
export const questionBlocks = (questionsRaw as { blocks: QuestionBlock[] }).blocks;
export const scoringConfig = scoringRaw as ScoringConfig;

if (rallyeConfig.stationCount !== rallyeConfig.stations.length) {
  throw new Error('stationCount muss der Anzahl der Stationen entsprechen.');
}
if (!rallyeConfig.finish?.title) {
  throw new Error('finish.title fehlt.');
}

export function distributeBlocks(blocks: QuestionBlock[], stationCount: number) {
  const result: QuestionBlock[][] = Array.from({ length: stationCount }, () => []);
  if (stationCount === 0) return result;
  blocks.forEach((block, index) => {
    const slot = Math.min(stationCount - 1, Math.floor((index * stationCount) / blocks.length));
    result[slot].push(block);
  });
  return result;
}

export function allQuestions() {
  return questionBlocks.flatMap((block) => block.questions);
}

export function blockLabel(block: QuestionBlock) {
  const names = block.categories.length ? block.categories : [...new Set(block.questions.map((q) => q.category))];
  return `Fragen · ${names.join(' / ')}`;
}

export function questionPoints(questionId: string) {
  return scoringConfig.questionPoints[questionId] ?? scoringConfig.questionDefault;
}

export function stationTaskPoints(stationId: number) {
  return scoringConfig.stationTaskPoints[String(stationId)] ?? scoringConfig.stationTaskDefault;
}
