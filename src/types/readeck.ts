// Readeck API Types - Essential Client Operations
export interface ReadeckApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface ReadeckApiResponse<T> {
  data: T;
  status: number;
  timestamp: string;
}

export interface ReadeckArticle {
  id: string;
  title: string;
  description?: string;
  url: string;
  site?: string;
  has_article: boolean;
  loaded: boolean;
  is_archived: boolean;
  is_marked: boolean;
  labels?: string[];
  published?: string;
  reading_time?: number;
  read_progress: number;
  created: string;
  updated: string;
  resources?: {
    article?: { src: string };
    image?: { src: string };
  };
}

export interface ReadeckArticleList {
  articles: ReadeckArticle[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

export interface ReadeckLoginRequest {
  username: string;
  password: string;
}

export interface ReadeckLoginResponse {
  id: string;
  token: string;
}

export interface ReadeckUser {
  id: string;
  username: string;
  email: string;
  created: string;
  updated: string;
}

export interface CreateArticleRequest {
  url: string;
  title?: string;
  labels?: string[];
}

export interface UpdateArticleRequest {
  title?: string;
  is_archived?: boolean;
  is_marked?: boolean;
  labels?: string[];
  read_progress?: number;
}

export interface ArticleFilters {
  limit?: number;
  offset?: number;
  search?: string;
  is_archived?: boolean;
  is_marked?: boolean;
  labels?: string;
}

export enum ReadeckErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
}
