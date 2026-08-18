export const TEXT_SIZE_TOKENS = ['sm', 'base', 'lg', 'xl', '2xl'] as const;

export type TextSizeToken = (typeof TEXT_SIZE_TOKENS)[number];

export const TEXT_SIZE_CSS_MAP: Record<TextSizeToken, string> = {
  sm: 'text-size-sm',
  base: 'text-size-base',
  lg: 'text-size-lg',
  xl: 'text-size-xl',
  '2xl': 'text-size-2xl',
};

export const TEXT_SIZE_REGEX = /\{size:(sm|base|lg|xl|2xl)\}(.*?)\{\/size\}/g;

export function isValidTextSizeToken(token: string): token is TextSizeToken {
  return (TEXT_SIZE_TOKENS as readonly string[]).includes(token);
}
