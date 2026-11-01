import { Component, type ReactNode } from 'react';

const CHUNK_ERROR = /dynamically imported module|importing a module script failed|loading chunk|module script/i;

/** Файл страницы не загрузился: оборвалась связь или новая выкладка заменила старые файлы. */
export const isChunkError = (e: unknown) => CHUNK_ERROR.test(String((e as Error | undefined)?.message ?? e));

/** Если не загрузилась ленивая часть страницы (карта, 3D-схема), падает только она, а не весь сайт. */
export class ChunkBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
