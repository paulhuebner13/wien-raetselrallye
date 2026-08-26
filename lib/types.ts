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
  type?: 'text' | 'textarea' | 'picture_round';
};

export type QuestionBlock = {
  id: string;
  categories: string[];
  questions: Question[];
};

export type RallyeConfig = {
  stationCount: number;
  finalStationId: number;
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
  guinnessPerLogo: number;
  architecturePerStyle: number;
  beerPerUniqueCan: number;
};
