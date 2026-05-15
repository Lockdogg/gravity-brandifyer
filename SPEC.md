# SPEC — Brand Manager Plugin

Подробные продуктовые требования. Дополняет `PLAN.md` (контекст и архитектура). Здесь — что именно показывает плагин, как валидирует, что записывает. Обновляется по мере работы.

## 1. Запуск и предусловия

- Плагин запускается через меню Figma "Plugins → Development → Brand Manager" (или из Figma Community когда опубликуем).
- При старте main thread проверяет, что текущий файл — это либа с коллекциями `Brand`, `Appearance`, `Private Colors`. Если нет — UI показывает экран-ошибку "This plugin must run on the YC Gravity UI library file." и кнопку "Close".
- Если файл подходит, но дизайнер не в ветке (а на main) — UI показывает мягкое предупреждение "You're editing the main branch. We recommend creating a branch first." с кнопками "Continue anyway" и "Close".
- Размер окна плагина: 480×640 px фиксировано. На шаге Preview можно расшириться до 720×640.

## 2. Визард: шаги

### 2.1. Welcome / Mode

- Заголовок: "Add a new brand".
- Опции: "Basic" (выбрана по умолчанию) и "Expert".
- Под каждой — пояснение в одну строку: "Basic: just pick a brand color." / "Expert: bring your own Private Colors library or customize more."
- Кнопки: "Cancel" (закрывает плагин), "Next".

### 2.2. Brand identity

- Поле "Brand name" — обязательное.
- Валидация: непустое, длина 2–32, только латинские буквы/цифры/пробел/тире/подчёркивание. Первый символ — буква. Без двойных пробелов. Чувствительно к регистру.
- Live-проверка уникальности: если бренд с таким именем уже есть в коллекции Brand — красная подсказка "Brand 'X' already exists. Pick a different name." Кнопка "Next" disabled.
- Подсказка под полем: "This will appear as a column in the Brand collection. Use clear naming like 'MyProduct' or 'My Product'."
- Кнопки: "Back", "Next".

### 2.3. Base brand

- Заголовок: "Base brand".
- Объяснение: "Tokens outside the Branding group (text, backgrounds, borders) will inherit from the base brand. You can customize them later."
- Список существующих брендов как радио-кнопки. Первый по дефолту — YC.
- (Опционально) превью: маленький свотч каждого бренда — его `Branding/Base Brand` цвет в Light-теме.
- Кнопки: "Back", "Next".

### 2.4. Brand color

- Заголовок: "Brand color".
- По умолчанию — единое поле hex + color picker.
- Опция "Different color in dark theme" (чекбокс/тогл) — раскрывает второе поле для Dark.
- Валидация: валидный hex (#RGB, #RRGGBB). При невалидном — поле красное, "Next" disabled.
- Дефолтное значение — `#3B82F6` (нейтральный синий), чтобы было видно, что бренд-цвет = акцент.
- Кнопки: "Back", "Next".

### 2.5. (Expert only) Custom Private Colors

- Заголовок: "Custom Private Colors library".
- Опция "Use shared Private Colors" (по умолчанию) vs "Use my own library".
- При "my own" — текстовое поле для JSON-описания внешней либы примитивов (формат: `[{ name, key, collection }, ...]`, как выдаёт текущий Dumper-плагин).
- Подсказка-ссылка: "Get this JSON by running the Dumper plugin on your Private Colors lib file."
- Валидация: парсится как JSON, является массивом, каждый элемент имеет поля name/key/collection.
- Кнопки: "Back", "Next".

### 2.6. Preview

- В верхней части — переключатель темы (4 кнопки: Light / Dark / Light HC / Dark HC). Default — Light.
- Под переключателем — рендер демки компонентов на фоне выбранной темы. Минимальный набор:
  - Кнопка primary (`Base Brand` фон, `Text Brand Contrast` текст).
  - Кнопка outline (`Line Brand` рамка, `Text Brand` текст).
  - Ссылка обычная (`Text Link`).
  - Ссылка visited (`Text Link Visited`).
  - Выделенный фрагмент текста (`Base Selection` фон).
  - Карточка-плашка с заголовком и текстом (использует Base/Text Primary из inherited base brand).
- Под демкой — шкала private brand-цветов в виде ряда свотчей с лейблами `50, 100, 150 … 1000`. Отдельно alpha-ряд и solid-ряд.
- Кнопки: "Back", "Add brand to library".

### 2.7. Summary / Confirm (объединён с Preview или отдельным шагом — на усмотрение)

- Перед записью: коротко "We will create N variables in Private Colors, M in Appearance, add 1 mode to Brand. This can be undone by reverting the branch in Figma."
- Кнопка "Add brand to library" — запускает запись.
- Прогресс-индикатор (Figma Variables API не моментален при массовой записи): "Writing private colors… (12 / 31)" и т.д.

### 2.8. Done

- Иконка успеха + заголовок "Brand '<Name>' added".
- Текст: "Submit this branch for review when ready. Use Figma's branching UI."
- Кнопка "Download CSS for engineering" — триггерит скачивание файла `<brand-name>.theme.css` (формат — см. раздел 4).
- Кнопка "Close".

## 3. Что записывается в либу (детально)

Используется namespace `<Brand>` равный нормализованному имени бренда (пробелы остаются как пробелы — Figma это допускает; используем точно тот же написанный пользователем вариант).

### 3.1. Коллекция Private Colors

Новые переменные в группе `<Brand>/Brand/`:

- `<Brand>/Brand/50` … `<Brand>/Brand/550` — 11 alpha-вариантов.
- `<Brand>/Brand/50 Solid` … `<Brand>/Brand/1000 Solid` — 20 solid-вариантов.

Каждая — RGB значение в зависимости от модуса (Light / Dark / Light HC / Dark HC).

Если у Private Colors сегодня нет модусов вообще (примитивы не пробрендированы по теме — нужно проверить при inspect), стратегия записи меняется: тогда у каждой переменной только одно значение, а различия между темами уходят в имя (как `<Brand>/Light/Brand/550 Solid` vs `<Brand>/Dark/Brand/550 Solid`). Решение принимается после Milestone 1.

### 3.2. Коллекция Appearance

Новая группа `<Brand>/` со всеми ~142 токенами, повторяющими структуру существующих брендов (YC взять как эталон). По категориям:

- `<Brand>/Branding/*` (~14 токенов) — алиасы на `<Brand>/Brand/...` из Private Colors.
- `<Brand>/Text/*` (~28 токенов) — алиасы на `<BaseBrand>/Text/*`.
- `<Brand>/Base/*` (~14) — алиасы на `<BaseBrand>/Base/*`.
- `<Brand>/Base Semantic/*` (~42) — алиасы на `<BaseBrand>/Base Semantic/*`.
- `<Brand>/Base Float/*` (~7) — алиасы на `<BaseBrand>/Base Float/*`.
- `<Brand>/Line/*` (~13) — алиасы на `<BaseBrand>/Line/*`.
- `<Brand>/Misc/*` (~6) — алиасы на `<BaseBrand>/Misc/*`.
- `<Brand>/Effect/*` (~5) — алиасы на `<BaseBrand>/Effect/*`.
- `<Brand>/Navigation/*` (~13) — алиасы на `<BaseBrand>/Navigation/*`.

У каждой переменной значения для всех 4 модусов Appearance.

Точное соответствие имён внутри Branding (на какой private brand index алиаситься какой токен) определяется по аналогии с YC. Это будет вынесено в `src/shared/constants.ts` как mapping-табличка:

```ts
const BRANDING_TOKEN_TO_PRIVATE_INDEX: Record<string, Record<ThemeMode, string>> = {
  'Base Brand':       { Light: '550 Solid', Dark: '550 Solid', 'Light HC': '600 Solid', 'Dark HC': '500 Solid' },
  'Base Brand Hover': { Light: '600 Solid', Dark: '600 Solid', 'Light HC': '800 Solid', 'Dark HC': '650 Solid' },
  'Text Brand':       { Light: '600 Solid', Dark: '550 Solid', 'Light HC': '650 Solid', 'Dark HC': '650 Solid' },
  // ... (выводится из чтения текущего YC в Milestone 1)
};
```

### 3.3. Коллекция Brand

Новый модус-колонка с именем = имя бренда. Все ~215 переменных коллекции Brand получают значение-алиас:

- Для `--g-color-base-brand`, `--g-color-text-brand` и других Branding-токенов → `<Brand>/Branding/<Token>`.
- Для `--g-color-text-primary`, `--g-color-base-generic` и т.д. → `<Brand>/<Group>/<Token>`.
- Для типографики и радиусов (общие, не пробрендированы) — берётся значение базового бренда (просто скопировать).

## 4. CSS экспорт

Формат — как у Themer (см. `docs/themer-output-example.css`). Структура:

```css
@import url('https://fonts.googleapis.com/css2?family=...');

.g-root {
    --g-font-family-sans: ...;
    /* типографика общая, копируется из базового бренда */
}

.g-root_theme_light {
    --g-color-private-brand-50: rgb(... / 0.1);
    ...
    --g-color-private-brand-1000-solid: rgb(...);

    --g-color-text-brand: var(--g-color-private-brand-...);
    --g-color-base-brand: var(--g-color-private-brand-...);
    /* и другие Branding-переопределения */
}

.g-root_theme_dark { ... }
.g-root_theme_light-hc { ... }
.g-root_theme_dark-hc { ... }
```

Имя файла: `<brand-name-lowercased>.theme.css`. Если имя содержит пробелы — заменить на `-`.

## 5. Валидации и edge cases

- **Имя бренда уже существует**: блокировать на этапе Brand identity.
- **Бренд-цвет идентичен фону темы**: предупреждение на шаге Preview (контраст < 1.5), не блокировать. Это про accessibility.
- **Базовый бренд отсутствует в либе**: невозможно (берём из существующих), но защититься от инсёртов вручную — если выбран ID, которого нет, ошибка.
- **Неудача записи на половине пути**: rollback. Реализуется через "сначала собираем всю транзакцию в памяти, валидируем, потом одной операцией пишем" или через ручной откат уже созданных переменных.
- **Лимит модусов исчерпан**: проверять при старте плагина число модусов в Brand-коллекции. Если ≥ 40 — экран "Brand mode limit reached. Contact DS team."
- **Закрытие плагина в середине визарда**: данные не сохраняются. Это ок — короткий флоу.

## 6. Локализация

- v1: только русский для UI-строк.
- Все строки — в одном файле `src/ui/strings.ts` для возможной локализации в будущем.

## 7. Telemetry

- v1: без телеметрии.
- На случай введения: события `wizard_started`, `wizard_completed`, `wizard_abandoned_at:<step>`, `commit_succeeded`, `commit_failed:<reason>`.

## 8. Не-функциональные требования

- Время от commit до "Done" — ≤ 5 секунд при нормальной либе (с прогресс-индикатором).
- Размер собранного плагина — желательно ≤ 1 МБ (Figma имеет лимиты).
- Никаких HTTP-запросов из плагина. Шрифты Google в CSS-экспорте — это для конечного фронтенда, плагин их не подгружает.

## 9. Что считаем done для v1

- Базовый режим: ввёл цвет → preview → commit → бренд виден в либе → CSS скачан. Без ошибок на happy path.
- Экспертный режим: то же с собственной либой Private Colors.
- Юнит-тесты на blend-функцию и валидаторы.
- Документация: README с инструкцией развёртывания, актуальный CLAUDE.md, актуальный SPEC.md.
- Залито на GitHub.
