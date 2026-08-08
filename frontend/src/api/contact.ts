import { apiClient } from './client';

export interface ContactMessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactSubmission {
  id: number;
  createdAt: string;
}

/** The Axios response interceptor unwraps { success, data } → data. */
async function post<T>(url: string, body: unknown): Promise<T> {
  return (await apiClient.post(url, body)) as unknown as T;
}

export const contactApi = {
  submitMessage: (data: ContactMessageInput) => post<ContactSubmission>('/contact', data),
};
