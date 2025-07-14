/**
 * Article Test Data Factory
 * Creates realistic test data for E2E article management tests
 */

import { Article } from '../../../src/types';

export interface ArticleTestDataOptions {
  id?: string;
  title?: string;
  url?: string;
  content?: string;
  summary?: string;
  isRead?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  tags?: string[];
  imageUrl?: string;
  readTime?: number;
  createdAt?: string;
  updatedAt?: string;
  sourceUrl?: string;
}

/**
 * Factory for creating test article data with realistic content
 */
export class ArticleTestDataFactory {
  private static idCounter = 1;

  static createArticle(options: ArticleTestDataOptions = {}): Article {
    const id = options.id || `test-article-${this.idCounter++}`;
    const now = new Date().toISOString();

    return {
      id,
      title: options.title || `Test Article ${id}`,
      url: options.url || `https://example.com/articles/${id}`,
      content: options.content || this.generateTestContent(),
      summary: options.summary || this.generateTestSummary(),
      isRead: options.isRead || false,
      isFavorite: options.isFavorite || false,
      isArchived: options.isArchived || false,
      tags: options.tags || [],
      imageUrl: options.imageUrl,
      readTime: options.readTime || Math.floor(Math.random() * 10) + 1,
      createdAt: options.createdAt || now,
      updatedAt: options.updatedAt || now,
      sourceUrl:
        options.sourceUrl ||
        options.url ||
        `https://example.com/articles/${id}`,
    };
  }

  static createArticleList(
    count: number,
    baseOptions?: ArticleTestDataOptions
  ): Article[] {
    return Array.from({ length: count }, (_, index) =>
      this.createArticle({
        ...baseOptions,
        id: `test-article-${this.idCounter + index}`,
        title: `${baseOptions?.title || 'Test Article'} ${index + 1}`,
      })
    );
  }

  static createSharedArticle(url: string, title?: string): Article {
    return this.createArticle({
      url,
      title: title || `Shared Article from ${new URL(url).hostname}`,
      sourceUrl: url,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }

  static createArticleWithStates(): {
    unread: Article;
    read: Article;
    favorite: Article;
    archived: Article;
  } {
    return {
      unread: this.createArticle({ isRead: false, title: 'Unread Article' }),
      read: this.createArticle({ isRead: true, title: 'Read Article' }),
      favorite: this.createArticle({
        isFavorite: true,
        title: 'Favorite Article',
      }),
      archived: this.createArticle({
        isArchived: true,
        title: 'Archived Article',
      }),
    };
  }

  static createArticleWithTags(tags: string[]): Article {
    return this.createArticle({
      tags,
      title: `Article with tags: ${tags.join(', ')}`,
    });
  }

  static createLongArticle(): Article {
    return this.createArticle({
      title:
        'This is a very long article title that should test how the UI handles lengthy content',
      content: this.generateLongContent(),
      summary:
        'This is a comprehensive summary of a very detailed article that covers multiple topics and concepts.',
      readTime: 15,
    });
  }

  private static generateTestContent(): string {
    return `
      <h1>Test Article Content</h1>
      <p>This is a test article with sample content for E2E testing.</p>
      <h2>Section 1</h2>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      <h2>Section 2</h2>
      <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
    `.trim();
  }

  private static generateTestSummary(): string {
    return 'This is a test article summary that provides a brief overview of the article content for testing purposes.';
  }

  private static generateLongContent(): string {
    const paragraphs = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
      'Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.',
      'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
    ];

    return `
      <h1>Comprehensive Test Article</h1>
      ${paragraphs.map((p, i) => `<h2>Section ${i + 1}</h2><p>${p}</p>`).join('\n')}
      <h2>Conclusion</h2>
      <p>This long-form article tests the complete article viewing experience with extensive content.</p>
    `.trim();
  }

  static resetCounter(): void {
    this.idCounter = 1;
  }
}
