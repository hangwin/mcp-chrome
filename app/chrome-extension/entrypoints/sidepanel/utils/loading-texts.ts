/**
 * Random Loading Texts
 * Used by TimelineStatusStep component to display fun waiting prompts
 */
import { getMessage } from '@/utils/i18n';

/**
 * Loading text message keys (loadingText1 through loadingText41)
 */
const LOADING_TEXT_COUNT = 41;

/**
 * Get a random loading text from localized messages
 */
export function getRandomLoadingText(): string {
  const index = Math.floor(Math.random() * LOADING_TEXT_COUNT) + 1;
  return getMessage(`loadingText${index}`);
}
