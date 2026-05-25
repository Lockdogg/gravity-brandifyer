# 0006 — Figma API: асинхронные ошибки и кеш библиотек

**Status**: Accepted  
**Date**: 2026-05-26

## Context

В ходе отладки Phase 2 (генерация Appearance group + Brand mode) выявились два класса проблем с Figma Plugin API, которые не очевидны из документации и потребовали нескольких часов экспериментов.

---

## Проблема 1 — `setValueForMode` с VARIABLE_ALIAS бросает ошибку асинхронно

### Симптом

`writeAppearanceGroup` (Phase 3b) падает с `cannot convert to object`. Appearance-переменные создаются (Phase 3a прошла), но значения не выставляются, и `writeBrandMode` никогда не запускается.

Все `try/catch` вокруг `setValueForMode` работали корректно синтаксически, но ошибка продолжала вырываться наружу без контекстного префикса — как будто `catch` не срабатывал.

### Причина

Figma обрабатывает некоторые вызовы `setValueForMode` **асинхронно** на уровне своего runtime. Когда значение `{ type: 'VARIABLE_ALIAS', id }` не может быть разрешено внутри Figma (например, ID ссылается на переменную в особом состоянии), ошибка бросается **не в том тике event loop**, что и `setValueForMode`. Синхронный `try { setValueForMode(...) } catch` не перехватывает её — она всплывает как unhandled rejection и ловится только внешним `await`-ом.

### Решение

Phase 3b переведена в режим **skip-on-error**: `catch(_err) { continue }`. Вместо того чтобы бросать при первой ошибке, цикл пропускает проблемные переменные и продолжает. Результат: функция завершается, `writeBrandMode` запускается, Brand-колонка создаётся.

Последствие: часть Appearance-переменных может остаться без значения для проблемного mode. На практике таких переменных мало (Base Background и подобные с raw RGBA), и Figma отображает их как "unset" — визуально заметно, но не блокирует работу.

### Паттерн для будущего

Любой `setValueForMode` в цикле должен использовать skip-on-error, а не re-throw, если задача — максимально завершить генерацию:

```typescript
try {
  variable.setValueForMode(modeId, value);
} catch (_err) {
  // Figma may throw asynchronously for some VARIABLE_ALIAS targets
  continue;
}
```

---

## Проблема 2 — `getVariablesInLibraryCollectionAsync` кеширует результат на сессию

### Симптом

После публикации обновлённой библиотеки (добавлен новый бренд ElectricGreen) плагин не показывал его в дропдауне «Бренд в библиотеке». Нативный UI Figma при этом уже видел новые переменные.

### Причина

`figma.teamLibrary.getVariablesInLibraryCollectionAsync(key)` и `getAvailableLibraryVariableCollectionsAsync()` кешируют ответ на уровне Figma-сессии. Нативный UI обновляется через свой канал (быстрее), а Plugin API видит снапшот, сделанный при открытии файла или последнем переподключении.

В отладочной сессии видели: коллекция реально содержала 3636 переменных (Raph 1212 + VibeCraft 1212 + ElectricGreen 1212), но API возвращал 2424 — данные до публикации ElectricGreen.

### Решение

**Единственный способ сбросить кеш — полный перезапуск Figma** (не просто закрыть файл).

Кнопка ↻ рядом с лейблом «Бренд в библиотеке» помогает только от **React-кеша**: если плагин был открыт до публикации и сохранил старый список в state, ↻ делает свежий `request-lib-brands`. Но если Figma API сам кеширует — ↻ не поможет.

### Workaround для дизайнера

После публикации обновлённой PC-библиотеки:
1. Полностью закрыть Figma
2. Открыть снова
3. Открыть плагин → нажать ↻

---

## Дополнительные выводы

- **`getVariableByIdAsync` может бросить `cannot convert to object`** вместо возврата `null` для некоторых внешних/устаревших ID. Все вызовы должны иметь `.catch(() => null)`.
- **Outer-обёртки WAG/WBM** (`writeAppearanceGroup` / `writeBrandMode`) помогают быстро локализовать источник ошибки при отладке: если в UI видно `WAG: ...` — ошибка в первой функции, `WBM: ...` — во второй.
- **Main thread `console.log`** в плагине не виден в DevTools iframe — нужен доступ к Figma Desktop main-thread console.
