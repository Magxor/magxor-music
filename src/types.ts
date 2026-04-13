export interface MusicGenerationRequest {
  prompt: string;
  customMode: boolean;
  instrumental: boolean;
  model: string;
  callBackUrl: string;
  style: string;
  title: string;
  negativeTags: string;
  vocalGender: string;
  tempo?: number;
  styleWeight: number;
  weirdnessConstraint: number;
  audioWeight: number;
  personaId: string;
  personaModel: string;
  uploadUrl?: string;
}

export interface SunoTrack {
  id: string;
  audio_url: string;
  stream_audio_url: string;
  image_url: string;
  title: string;
  tags: string;
  duration: number | null;
  prompt?: string;
  model_name?: string;
  createTime?: string;
}

export interface SunoCallbackData {
  code: number;
  msg: string;
  data: {
    callbackType: 'text' | 'first' | 'complete' | 'error';
    task_id: string;
    data: SunoTrack[] | null;
  };
}

export interface MusicGenerationResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: string;
    response?: {
      taskId: string;
      sunoData: SunoTrack[];
    };
    errorCode: string | null;
    errorMessage: string | null;
  };
}

export type AppStep = 'landing' | 'purpose' | 'style' | 'lyrics' | 'result';

export interface SessionData {
  taskId: string | null;
  title: string;
  generatedTracks: SunoTrack[];
  paidTrackIds: string[];
  savedAt: number;
}

export interface AppState {
  step: AppStep;
  purpose: string;
  genre: string;
  tempo: number;
  mood: string;
  title: string;
  lyrics: string;
  isGenerating: boolean;
  taskId: string | null;
  // Generation parameters
  customMode: boolean;
  instrumental: boolean;
  negativeTags: string;
  vocalGender: 'm' | 'f' | 'none';
  styleWeight: number;
  weirdnessConstraint: number;
  audioWeight: number;
  personaId: string;
  uploadUrl: string;
  generatedTracks: SunoTrack[];
  // Payment
  paidTrackIds: string[];
  error?: string | null;
}
