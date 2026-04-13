import { MusicGenerationRequest, MusicGenerationResponse, SunoTrack } from '../types';

const API_URL = '/api/generate';
const TASK_URL = '/api/task';

export async function generateMusic(data: MusicGenerationRequest): Promise<MusicGenerationResponse> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function getTaskDetails(taskId: string): Promise<SunoTrack[] | null> {
  const response = await fetch(`${TASK_URL}/${taskId}`);

  if (!response.ok) {
    console.warn(`getTaskDetails: HTTP ${response.status} for task ${taskId}`);
    return null;
  }

  const json = await response.json();

  // Detectar errores según el formato de callback y API
  if (json?.code && json.code !== 200) {
    throw new Error(json.msg || `Error ${json.code} en Suno API`);
  }
  
  if (json?.status === 'error') {
    throw new Error(json.msg || "La generación ha fallado. Intenta ajustar la letra o el estilo.");
  }

  // Caso 1: llegó por callback y está en caché del server (formato SunoCallbackData)
  // { code: 200, data: { callbackType: 'complete', data: [...tracks] } }
  if (json?.data?.callbackType === 'complete' && Array.isArray(json?.data?.data)) {
    return json.data.data;
  }

  // Caso 2: respuesta directa de kie.ai polling
  // { code: 200, data: { response: { sunoData: [...tracks] } } }
  const tracks = json?.data?.response?.sunoData;
  if (Array.isArray(tracks) && tracks.length > 0) {
    return tracks;
  }

  // Todavía procesando
  return null;
}