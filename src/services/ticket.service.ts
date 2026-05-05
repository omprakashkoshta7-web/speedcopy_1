import apiClient from './api.service';
import { API_CONFIG } from '../config/api.config';

// ─── Types matching backend DB schema exactly ────────────────────────────────

export interface TicketReply {
  _id?: string;
  authorId: string;
  authorRole: 'user' | 'vendor' | 'admin' | 'staff' | 'delivery_partner' | 'super_admin';
  message: string;
  attachments: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type TicketCategory =
  | 'order_issue'
  | 'payment_issue'
  | 'delivery_issue'
  | 'product_issue'
  | 'account_issue'
  | 'other';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  _id: string;
  userId: string;
  orderId?: string;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: string;
  createdForRole: 'user' | 'vendor' | 'delivery_partner' | 'staff' | 'admin';
  visibilityScope: 'customer' | 'vendor_internal' | 'delivery_internal' | 'ops_internal';
  attachments: string[];
  metadata?: any;
  replies: TicketReply[];
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  orderId?: string;
  attachments?: string[];
}

export interface GetTicketsParams {
  status?: TicketStatus;
  category?: TicketCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TicketListResponse {
  tickets: Ticket[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TicketSummary {
  status_counts: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
  recent_tickets: Ticket[];
}

export interface HelpCenterCategory {
  id: string;
  title: string;
  description: string;
  cta_text: string;
}

export interface HelpCenter {
  faq_categories: HelpCenterCategory[];
  ticket_issue_types: TicketCategory[];
  priority_options: TicketPriority[];
  recent_tickets: Ticket[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

class TicketService {
  /** POST /api/notifications/tickets — create ticket */
  async createTicket(data: CreateTicketData): Promise<{ success: boolean; message: string; data: Ticket }> {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.TICKETS.CREATE, data);
      return response.data;
    } catch (err: any) {
      // Fallback: try gateway path if internal path fails
      if (err?.response?.status === 404) {
        const response = await apiClient.post('/api/ticket', data);
        return response.data;
      }
      throw err;
    }
  }

  /** GET /api/notifications/tickets — list my tickets */
  async getMyTickets(params?: GetTicketsParams): Promise<{ success: boolean; data: TicketListResponse }> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.TICKETS.GET_ALL, { params });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await apiClient.get('/api/ticket', { params });
        return response.data;
      }
      throw err;
    }
  }

  /** GET /api/notifications/tickets/summary */
  async getTicketSummary(): Promise<{ success: boolean; data: TicketSummary }> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.TICKETS.GET_SUMMARY);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await apiClient.get('/api/ticket/summary');
        return response.data;
      }
      throw err;
    }
  }

  /** GET /api/notifications/help-center */
  async getHelpCenter(): Promise<{ success: boolean; data: HelpCenter }> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.TICKETS.GET_HELP_CENTER);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await apiClient.get('/api/ticket/help-center');
        return response.data;
      }
      throw err;
    }
  }

  /** GET /api/notifications/tickets/:id */
  async getTicketById(id: string): Promise<{ success: boolean; data: Ticket }> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.TICKETS.GET_BY_ID(id));
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await apiClient.get(`/api/ticket/${id}`);
        return response.data;
      }
      throw err;
    }
  }

  /** POST /api/notifications/tickets/:id/reply */
  async replyToTicket(
    id: string,
    message: string,
    attachments?: string[]
  ): Promise<{ success: boolean; message: string; data: Ticket }> {
    console.log('💬 [TicketService] Replying to ticket:', { id, messageLength: message.length, attachmentCount: attachments?.length || 0, attachments });
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.TICKETS.REPLY(id), {
      message,
      attachments: attachments || [],
    });
    console.log('✅ [TicketService] Reply response:', response.data);
    return response.data;
  }

  /** POST /api/notifications/tickets/uploads — multipart/form-data, max 10 files */
  async uploadAttachments(files: File[]): Promise<{ success: boolean; data: { attachments: string[] } }> {
    const formData = new FormData();
    files.forEach(file => formData.append('attachments', file));
    console.log('📤 [TicketService] Uploading files:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    try {
      // Try primary endpoint: /api/notifications/tickets/uploads
      // Note: Do NOT set Content-Type manually - browser will set it with boundary
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.TICKETS.UPLOADS, formData);
      console.log('✅ [TicketService] Upload response:', response.data);
      return response.data;
    } catch (err: any) {
      console.error('❌ [TicketService] Primary upload endpoint failed:', err?.response?.status);
      
      // Fallback: try /api/tickets/uploads (without notifications prefix)
      if (err?.response?.status === 404) {
        console.log('🔄 [TicketService] Trying fallback endpoint: /api/tickets/uploads');
        try {
          const response = await apiClient.post('/api/tickets/uploads', formData);
          console.log('✅ [TicketService] Fallback upload response:', response.data);
          return response.data;
        } catch (fallbackErr: any) {
          console.error('❌ [TicketService] Fallback upload also failed:', fallbackErr?.response?.status);
        }
      }
      
      throw err;
    }
  }

  /** PATCH /api/ticket/:id/status — admin/staff only */
  async updateTicketStatus(
    id: string,
    status: TicketStatus
  ): Promise<{ success: boolean; data: Ticket }> {
    const response = await apiClient.patch(API_CONFIG.ENDPOINTS.TICKETS.UPDATE_STATUS(id), { status });
    return response.data;
  }

  /** PATCH /api/ticket/:id/assign — admin/staff only */
  async assignTicket(id: string, assignedTo: string): Promise<{ success: boolean; data: Ticket }> {
    const response = await apiClient.patch(API_CONFIG.ENDPOINTS.TICKETS.ASSIGN(id), { assignedTo });
    return response.data;
  }

  /** POST /api/ticket/:id/escalate — admin/staff only */
  async escalateTicket(id: string, message?: string): Promise<{ success: boolean; data: Ticket }> {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.TICKETS.ESCALATE(id), {
      message: message || 'Ticket escalated internally',
    });
    return response.data;
  }
}

export default new TicketService();
