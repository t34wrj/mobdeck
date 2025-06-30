export interface Article {
    id: string;
    title: string;
    summary: string;
    content: string;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface User {
    id: string;
    username: string;
    email: string;
    token: string;
}

export interface AppState {
    articles: Article[];
    user: User | null;
}

export interface SearchProps {
    onSearch: (query: string) => void;
    onChange: (query: string) => void;
}

export interface ArticleCardProps {
    article: Article;
    onPress: () => void;
}