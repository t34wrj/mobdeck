export const formatDate = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

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

export const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};
