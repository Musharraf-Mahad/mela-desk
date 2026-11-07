import apiClient from './client';
import type { ApiResponse } from '../types/api';
import type {
  PublicTicketSubmissionPayload,
  PublicTicketSubmissionResponse,
  PublicTicketTrackResponse,
} from '../types/ticket';

export const publicTicketApi = {
  async submitTicket(payload: PublicTicketSubmissionPayload): Promise<PublicTicketSubmissionResponse> {
    const formData = new FormData();
    formData.append('guestName', payload.guestName);
    formData.append('guestEmail', payload.guestEmail);
    formData.append('subject', payload.subject);
    formData.append('description', payload.description);
    formData.append('category', payload.category);

    if (payload.files && payload.files.length > 0) {
      for (const file of payload.files) {
        formData.append('files', file);
      }
    }

    const res = await apiClient.post<ApiResponse<PublicTicketSubmissionResponse>>('/public/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to submit public ticket');
    }
    return res.data.data;
  },

  async trackTicket(ticketNumber: string, trackingToken: string): Promise<PublicTicketTrackResponse> {
    const res = await apiClient.post<ApiResponse<PublicTicketTrackResponse>>('/public/tickets/track', {
      ticketNumber,
      trackingToken,
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Ticket not found or tracking token invalid');
    }
    return res.data.data;
  },

  getAttachmentDownloadUrl(ticketNumber: string, attachmentId: string, trackingToken: string): string {
    const base = apiClient.defaults.baseURL || '/api';
    return `${base}/public/tickets/${encodeURIComponent(ticketNumber)}/attachments/${encodeURIComponent(attachmentId)}?token=${encodeURIComponent(trackingToken)}`;
  },
};
