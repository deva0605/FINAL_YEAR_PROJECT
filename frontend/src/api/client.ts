const API_BASE_URL = 'http://localhost:8000';

export class APIError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchWrapper<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new APIError(`HTTP error! status: ${response.status}`, response.status);
    }

    const data = await response.json();
    if (data.error) {
       throw new APIError(data.error);
    }
    return data;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(error instanceof Error ? error.message : 'Unknown network error');
  }
}

export default fetchWrapper;
