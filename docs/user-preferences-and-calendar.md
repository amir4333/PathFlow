# PathFlow: Language & Calendar Preferences Architecture

## 1. Overview & Core Philosophy

PathFlow provides user-configurable preferences for:
1. **Application Language**: `en` (English) or `fa` (Persian/Farsi)
2. **Calendar System**: `gregorian` (Gregorian solar) or `persian` (Jalali solar)

### Independence Principle
These two preferences are **completely independent**:
* An English user can view dates in the Persian/Jalali calendar (e.g. `1 Mehr 1405`).
* A Persian user can view dates in the Gregorian calendar (e.g. `۲۳ سپتامبر ۲۰۲۶`).
* Numerals follow the selected language:
  * In Persian (`fa`), numbers and digits appear in Persian numerals (`۰-۹`, e.g. `۱۴۰۵`, `۹۰ دقیقه`).
  * In English (`en`), numbers and digits appear in standard Latin numerals (`0-9`, e.g. `1405`, `90m`).

| Language | Calendar | Date Example | Numeral Example |
| :--- | :--- | :--- | :--- |
| **English** | **Gregorian** | September 23, 2026 | 90m |
| **English** | **Persian** | 1 Mehr 1405 | 90m |
| **Persian** | **Gregorian** | ۲۳ سپتامبر ۲۰۲۶ | ۹۰ دقیقه |
| **Persian** | **Persian** | ۱ مهر ۱۴۰۵ | ۹۰ دقیقه |

---

## 2. Storage & Domain Invariant

### Pure Presentation Boundary
* **No Database Migrations**: The underlying IndexedDB schemas, domain entities (`Goal`, `Roadmap`, `Task`, `Session`, `WeeklyPlan`), and application services store dates strictly as standard ISO 8601 UTC strings (e.g., `2026-09-23T14:30:00.000Z`).
* **Session Calculations**: Duration calculation `Math.round((endMs - startMs) / 60000)` and elapsed seconds arithmetic are completely untouched.
* **Conversion Location**: Date, time, and calendar transformations occur purely in `src/app/preferences/dateFormatting.ts` at the presentation layer using the browser's standard `Intl.DateTimeFormat` with Unicode calendar extensions (`-u-ca-persian` / `-u-ca-gregory`) and numbering system extensions (`-nu-arabext` / `-nu-latn`).

---

## 3. Persistence & Offline-First

* Preferences are saved to `localStorage` under key `pathflow_user_preferences`.
* The configuration survives page reloads and browser restarts.
* Fully offline: No network requests, external APIs, or server synchronization required.

---

## 4. Date/Time Input Architecture & Current Limitation

* **Manual Session Form**: To prevent destabilizing cross-browser date-time inputs, the form uses the native `datetime-local` input (operating in local standard time) paired with a live presentation preview card underneath that immediately shows how the selected timestamp will be displayed in the active calendar and language.
* **Documented Limitation**: The browser-native `<input type="datetime-local">` displays using the operating system's native input mask. When Persian calendar input is needed directly in future phases, a dedicated Jalali date-picker component can be plugged into the presentation layer without altering the underlying ISO storage format.

---

## 5. UI & Navigation Access

* **Settings Route**: Available at `#settings` (`AppRouteId: 'settings'`).
* **Sidebar Link**: Direct link with a `Settings` icon in the navigation bar.
* **Header Button**: Quick button in the application header displaying active configuration pills (e.g., `en • EN` or `fa • FA`).
* **Live Preview**: The Settings view includes a dynamic live formatting card demonstrating the four combinations and active numeral representations in real time.
