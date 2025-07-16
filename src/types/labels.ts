export interface Label {
  id: string;
  name: string;
  color?: string;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LabelFilters {
  searchQuery?: string;
  sortBy?: 'name' | 'created_at' | 'article_count';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CreateLabelRequest {
  name: string;
  color?: string;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: string;
}

export interface AssignLabelRequest {
  labelId: string;
  articleId: string;
}

export interface RemoveLabelRequest {
  labelId: string;
  articleId: string;
}