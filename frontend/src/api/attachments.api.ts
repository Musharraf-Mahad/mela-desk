import apiClient from './client';
import type { ApiResponse } from '../types/api';
import type { Attachment } from '../types/ticket';

export const attachmentsApi = {
  async getAttachments(ticketId: string): Promise<Attachment[]> {
    const res = await apiClient.get<ApiResponse<{ attachments: Attachment[] }>>(`/tickets/${ticketId}/attachments`);
    return res.data.data?.attachments || [];
  },

  async uploadAttachments(ticketId: string, files: File[]): Promise<Attachment[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const res = await apiClient.post<ApiResponse<{ attachments: Attachment[] }>>(
      `/tickets/${ticketId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return res.data.data?.attachments || [];
  },

  async deleteAttachment(ticketId: string, attachmentId: string): Promise<void> {
    await apiClient.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
  },

  getDownloadUrl(ticketId: string, attachmentId: string): string {
    const base = apiClient.defaults.baseURL || '/api';
    return `${base}/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`;
  },
};
