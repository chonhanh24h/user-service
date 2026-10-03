import { SPECIAL_CHARS_REGEX } from '../users.consts';

// HTML-encode the title to prevent XSS (mirrors the entities.encode from original code)
export function encodedSearchTitle(title: string) {
  return title.trim().replace(SPECIAL_CHARS_REGEX, '').replace(/'/g, '&#039;');
}

export function encodedSearchUrl(url: string) {
  return url.replace(/page=[0-9]*$/g, 'page=1');
}
