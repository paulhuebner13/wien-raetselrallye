export type StationConfig = {
  id: number;
  title: string;
  text: string;
  images: string[];
  answerLabel?: string;
  taskPoints?: number;
};

export type ArchitectureStyle = {
  name: string;
  description: string;
};

export type Question = {
  id: string;
  category: string;
  text: string;
  type?: 'text' | 'textarea' | 'picture_round' | 'matching' | 'music_round';
  images?: string[];
  items?: string[];
  options?: string[];
  tracks?: Array<{ label: string; src: string }>;
};

export type QuestionBlock = {
  id: string;
  name: string;
  categories: string[];
  questions: Question[];
  durationMinutes: number;
};

export type QuestionsConfig = {
  blockDurationMinutes: number;
  categories: string[];
  blocks: Array<{ id: string; name: string; categories: string[] }>;
  questions: Question[];
};

export type RallyeConfig = {
  stationCount: number;
  finish: {
    title: string;
  };
  intro: {
    title: string;
    body: string[];
    phoneRules: string[];
  };
  stations: StationConfig[];
  architectureStyles: ArchitectureStyle[];
};

export type ScoringConfig = {
  hintPointsMax: number;
  stationTaskDefault: number;
  stationTaskPoints: Record<string, number>;
  questionDefault: number;
  questionPoints: Record<string, number>;
  pictureRoundPartialThreshold: number;
  pictureRoundPartialPoints: number;
  pictureRoundFullPoints: number;
  musicRoundPerCorrect: number;
  musicRoundStagePoints: [number, number, number, number];
  guinnessPerLogo: number;
  architecturePerStyle: number;
  beerPerUniqueCan: number;
};
