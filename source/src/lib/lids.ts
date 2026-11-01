// Пары «основание → подходящие крышки» из снимка каталога (vite.config: __LIDS__, правило — tools/pairs.mjs).
// Модуль грузится лениво — только когда в корзине что-то есть.
declare const __LIDS__: Record<string, string[]>;
export const LIDS: Record<string, string[]> = typeof __LIDS__ !== 'undefined' ? __LIDS__ : {};
