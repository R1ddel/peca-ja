/**
 * Guarda a rolagem de cada tela e devolve no mesmo ponto ao voltar.
 * O app troca a página inteira, então a tela anterior nasce de novo no topo
 * se ninguém lembrar onde ela estava.
 */
import React from 'react';
import { Platform, ScrollView } from 'react-native';
import { usePathname } from 'expo-router';

const memory = new Map<string, number>();
let currentPath = '/';
let userMoved = false;

function remember(path: string, y: number) {
  if (!Number.isFinite(y) || y < 0) return;
  const prev = memory.get(path) ?? 0;
  // A tela nova dispara rolagem 0 ao nascer. Isso não pode apagar o ponto salvo.
  if (y < 8 && prev > 8 && !userMoved) return;
  memory.set(path, y);
}

type ScrollEventLike = {
  nativeEvent?: {
    contentOffset?: { y?: number };
    layoutMeasurement?: { height?: number };
  };
};

function installNativeMemory() {
  const proto = ScrollView.prototype as unknown as {
    render?: () => unknown;
    __pecajaScroll?: boolean;
  };
  if (proto.__pecajaScroll || typeof proto.render !== 'function') return;
  const original = proto.render;
  proto.render = function renderWithMemory(this: {
    props: { horizontal?: boolean; pagingEnabled?: boolean };
    __pecajaScroll?: boolean;
    __pecajaRestored?: boolean;
    _handleScroll: (e: ScrollEventLike) => void;
    _handleScrollEndDrag: (e: ScrollEventLike) => void;
    _handleContentOnLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
    scrollTo: (opts: { x: number; y: number; animated: boolean }) => void;
  }) {
    if (!this.__pecajaScroll) {
      this.__pecajaScroll = true;
      const origScroll = this._handleScroll;
      const origEnd = this._handleScrollEndDrag;
      const origSize = this._handleContentOnLayout;
      const note = (e: ScrollEventLike) => {
        if (this.props.horizontal || this.props.pagingEnabled) return;
        const height = e.nativeEvent?.layoutMeasurement?.height ?? 0;
        if (height && height < 220) return;
        const y = e.nativeEvent?.contentOffset?.y;
        if (typeof y === 'number') remember(currentPath, y);
      };
      this._handleScroll = (e) => {
        origScroll(e);
        note(e);
      };
      this._handleScrollEndDrag = (e) => {
        userMoved = true;
        origEnd(e);
        note(e);
      };
      this._handleContentOnLayout = (e) => {
        origSize(e);
        if (this.props.horizontal || this.props.pagingEnabled || this.__pecajaRestored) return;
        const saved = memory.get(currentPath) ?? 0;
        const height = e.nativeEvent.layout.height;
        if (saved > 8 && height > saved + 24) {
          this.__pecajaRestored = true;
          this.scrollTo({ x: 0, y: saved, animated: false });
        }
      };
    }
    return original.call(this);
  };
  proto.__pecajaScroll = true;
}

function isPageScroller(el: HTMLElement): boolean {
  if (el.clientHeight < 240) return false;
  const style = window.getComputedStyle(el);
  return style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay';
}

function mainScroller(): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>('*');
  let best: HTMLElement | null = null;
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!isPageScroller(el)) continue;
    if (!best || el.clientHeight > best.clientHeight) best = el;
  }
  return best;
}

function installWebMemory() {
  if (typeof document === 'undefined') return;
  const flag = '__pecajaScrollWeb';
  const doc = document as Document & { [key: string]: boolean };
  if (doc[flag]) return;
  doc[flag] = true;

  const markUser = () => {
    userMoved = true;
  };
  document.addEventListener('wheel', markUser, true);
  document.addEventListener('touchmove', markUser, true);
  document.addEventListener(
    'scroll',
    (event) => {
      const target = event.target;
      const el =
        target instanceof HTMLElement
          ? target
          : (document.scrollingElement as HTMLElement | null);
      if (!el || (target instanceof HTMLElement && !isPageScroller(el))) return;
      remember(currentPath, el.scrollTop);
    },
    true
  );
}

function restoreWeb(path: string) {
  const saved = memory.get(path) ?? 0;
  if (saved < 8) return;
  let tries = 0;
  const tick = () => {
    if (currentPath !== path) return;
    const el = mainScroller();
    if (el && el.scrollHeight > saved + 24) {
      if (Math.abs(el.scrollTop - saved) > 2) el.scrollTop = saved;
      return;
    }
    tries += 1;
    if (tries < 14) setTimeout(tick, 70);
  };
  tick();
}

if (Platform.OS === 'web') installWebMemory();
else installNativeMemory();

export function ScrollPlaceKeeper() {
  const path = usePathname() || '/';
  if (currentPath !== path) {
    currentPath = path;
    userMoved = false;
  }

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    restoreWeb(path);
  }, [path]);

  return null;
}
