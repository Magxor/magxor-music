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

  // Caso 3: Formato alternativo directo en data
  // { code: 200, data: [...tracks] }
  if (Array.isArray(json?.data) && json.data.length > 0) {
    return json.data;
  }

  // Caso 4: respuesta con tasks anidado
  // { code: 200, data: { tasks: [...], response: {...} } }
  const tasksTracks = json?.data?.tasks || json?.data?.response?.tasks;
  if (Array.isArray(tasksTracks) && tasksTracks.length > 0) {
    return tasksTracks;
  }

  // Estado aún procesando - verificar status
  if (json?.data?.status === 'pending' || json?.data?.status === 'processing') {
    return null;
  }

  // Log para debug
  console.log('getTaskDetails: response structure:', JSON.stringify(json, null, 2));
  
  // Todavía procesando
  return null;
}