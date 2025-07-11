/**
 * Formats a date string to a localized, human-readable format
 * @param dateString - ISO date string to format
 * @returns Localized date string in "Month Day, Year" format
 * @example
 * formatDate("2023-12-25T10:00:00Z") // Returns "December 25, 2023"
 */
export const formatDate = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

/**
 * Filters articles by keyword search in title and summary
 * @param articles - Array of articles to filter
 * @param keyword - Search keyword to match against title and summary
 * @returns Filtered array of articles matching the keyword
 * @example
 * filterArticlesByKeyword(articles, "React") // Returns articles with "React" in title or summary
 */
export const filterArticlesByKeyword = (
  articles: any[],
  keyword: string
): any[] => {
  return articles.filter(
    article =>
      article.title.toLowerCase().includes(keyword.toLowerCase()) ||
      article.summary.toLowerCase().includes(keyword.toLowerCase())
  );
};

/**
 * Creates a debounced function that delays invoking func until after delay milliseconds
 * have elapsed since the last time the debounced function was invoked
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 * @example
 * const debouncedSearch = debounce(searchFunction, 300);
 * debouncedSearch("query"); // Will execute after 300ms of no more calls
 */
export const debounce = (func: Function, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};
