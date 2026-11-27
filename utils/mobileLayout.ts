import { useWindowDimensions } from 'react-native';

/** Larguras de validação mobile (phones). Acima disso = desktop / layout aprovado. */
export const MOBILE_MAX_WIDTH = 430;

export function isMobileWidth(width: number): boolean {
  return width <= MOBILE_MAX_WIDTH;
}

/** True só em viewports mobile — desktop/web largo permanece intacto. */
export function useIsMobileLayout(): boolean {
  const { width } = useWindowDimensions();
  return isMobileWidth(width);
}
