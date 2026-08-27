import stationsRaw from '@/config/stations.json';
import questionsRaw from '@/config/questions.json';
import scoringRaw from '@/config/scoring.json';
import type { QuestionBlock, QuestionsConfig, RallyeConfig, ScoringConfig } from './types';

export const rallyeConfig = stationsRaw as RallyeConfig;
export const questionsConfig = questionsRaw as QuestionsConfig;
export const scoringConfig = scoringRaw as unknown as ScoringConfig;

const categorySet = new Set(questionsConfig.categories);
const assignedCategories = new Set<string>();
for (const block of questionsConfig.blocks) {
  for (const category of block.categories) {
    if (!categorySet.has(category)) throw new Error(`Kategorie fehlt in categories: ${category}`);
    if (assignedCategories.has(category)) throw new Error(`Kategorie ist mehreren Blöcken zugeordnet: ${category}`);
    assignedCategories.add(category);
  }
}
for (const question of questionsConfig.questions) {
  if (!categorySet.has(question.category)) throw new Error(`Unbekannte Kategorie bei ${question.id}: ${question.category}`);
}

export const questionBlocks: QuestionBlock[] = questionsConfig.blocks.map((block) => ({
  ...block,
  durationMinutes: questionsConfig.blockDurationMinutes || 5,
  questions: questionsConfig.questions.filter((question) => block.categories.includes(question.category)),
}));

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
  return questionsConfig.questions;
}

export function blockForQuestion(questionId: string) {
  return questionBlocks.find((block) => block.questions.some((question) => question.id === questionId));
}

export function blockLabel(block: QuestionBlock) {
  return block.name;
}

export function mergeScoringConfig(overrides?: Partial<ScoringConfig> | null): ScoringConfig {
  const source = overrides ?? {};
  return {
    ...scoringConfig,
    ...source,
    stationTaskPoints: { ...scoringConfig.stationTaskPoints, ...(source.stationTaskPoints ?? {}) },
    questionPoints: { ...scoringConfig.questionPoints, ...(source.questionPoints ?? {}) },
    musicRoundStagePoints: (Array.isArray(source.musicRoundStagePoints) ? source.musicRoundStagePoints : scoringConfig.musicRoundStagePoints) as [number, number, number, number],
  };
}

export function questionPoints(questionId: string, config: ScoringConfig = scoringConfig) {
  return config.questionPoints[questionId] ?? config.questionDefault;
}

export function stationTaskPoints(stationId: number, config: ScoringConfig = scoringConfig) {
  return config.stationTaskPoints[String(stationId)] ?? config.stationTaskDefault;
}

export function questionMaxPoints(questionId: string, config: ScoringConfig = scoringConfig) {
  if (questionId === 'picture-round') return config.pictureRoundFullPoints;
  if (questionId === 'music-round') return config.musicRoundStagePoints[0] * 4;
  return questionPoints(questionId, config);
}
