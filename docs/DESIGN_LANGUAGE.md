DESIGN LANGUAGE — Courtly
1. Product essence

Courtly — це платформа для оренди тенісних кортів.
Її задача — дати людині максимально простий шлях від наміру “хочу пограти” до дії “корт заброньований”.

Продукт стоїть на 3 основних ідеях:

Швидко знайти корт поруч
фільтрація по місту та району;
пошук найближчих кортів;
мапа як ключовий інструмент discovery.
Легко вибрати зручний слот
слот-система по 30 хв;
мінімальне бронювання — 1 година;
простий, очевидний time-picker без когнітивного сміття.
Прозоро керувати своїми бронюваннями
підтвердження;
активні та минулі бронювання;
обране;
відгуки.
One-line positioning

Courtly = clean, fast, premium tennis booking experience.

Не “маркетплейс усього підряд”, не “важкий CRM-like інтерфейс”, а легкий сервіс для бронювання корту.

2. Brand character
2.1. Personality

Courtly має відчуватись як:

sporty
clean
fast
urban
confident
premium but accessible

Це не luxury-club-only vibe і не дешевий “агрегатор спортпослуг”.
Правильне відчуття: сучасний digital-сервіс для людей, які хочуть швидко грати в теніс.

2.2. Visual metaphor

Візуально Courtly опирається на:

тенісний м’яч → лаймовий акцент;
корт / розмітка / геометрія → чистий layout, сітка, прямі блоки;
рух м’яча → м’які траєкторії, дуги, subtle motion;
бронювання часу → чіткі slot grids, ритм, повторюваність.
3. Core design principle
Main principle

Make booking feel effortless.

У Courtly все має працювати на це:

швидкий search;
очевидний вибір;
мінімум зайвого декору там, де треба приймати рішення;
максимум clarity у слотах, статусах, адресах, цінах, підтвердженні.
Secondary principle

High-energy brand outside, calm UX inside.

Тобто:

бренд може бути сміливішим в hero / onboarding / промо;
основний продукт має бути чистим і функціональним;
booking flow не можна перетворювати на Behance-артхаус.
4. Color system

Лого вже дає дуже сильний напрямок:
black + tennis lime + off-white.

4.1. Primary palette
Token	Hex	Usage
--bg-primary	#F5F5F3	основний світлий фон
--bg-secondary	#ECECE8	secondary surfaces
--text-primary	#0B0B0B	основний текст
--text-secondary	#5F6460	другорядний текст
--text-muted	#8A8F8A	підписи, helper text
--brand-lime	#C7E21D	головний акцент, CTA, active
--brand-lime-strong	#B8D615	hover / pressed
--brand-lime-soft	#EEF6BE	selection backgrounds
--surface-dark	#111111	dark surfaces / hero / footer
--surface-dark-2	#1A1A1A	cards on dark backgrounds
--border-light	#DDDED8	light borders
--border-dark	#2A2A2A	borders on dark surfaces
--success	#2E9D57	booking success
--warning	#F4B740	caution / limited availability
--error	#D84C4C	invalid selection / errors
--info	#2E7DD7	informational badges
4.2. Color usage logic
Light mode — основний режим

Основний продукт краще працює у light mode:

background: off-white;
cards: white / very light gray;
text: near-black;
accent: lime.

Це найкраще для:

мап;
слотів;
списків;
календарів;
особистого кабінету.
Dark mode — optional / branded moments

Dark mode або dark sections добре заходять для:

landing hero;
promo blocks;
brand sections;
footer;
empty states;
optional user preference.
Accent policy

Lime має бути акцентом, а не фоном усього підряд.

Добре для:

primary CTA;
selected slot;
active tab;
map pin active state;
rating highlight;
favorite state;
section highlights.

Погано для:

довгих текстів;
великих фонових масивів у booking flow;
великих таблиць слотів.
5. Typography
5.1. Typography mood

Лого має сильний, кастомний, майже futuristic/sport look.
Але в UI потрібна дуже читабельна системна типографіка.

Recommended pair
Brand / display font

Для заголовків бренду можна взяти щось у стилі:

Sora
Space Grotesk
Clash Display
General Sans
або кастомний display typeface, близький по вайбу до логотипу
UI / body font

Для основного інтерфейсу:

Inter
Manrope
SF Pro
Plus Jakarta Sans
Recommendation

Найбезпечніший сет:

Display: Sora
UI: Inter

Це буде виглядати clean, techy і достатньо sporty.

5.2. Type scale
Desktop
Token	Size	Line Height	Weight	Usage
Display XL	72–88 px	0.95	700	hero headline
Display L	56–64 px	1.0	700	landing title
H1	40–48 px	1.1	700	page title
H2	30–36 px	1.15	700	section title
H3	24–28 px	1.2	600	card groups, court names
H4	20–22 px	1.25	600	subheaders
Body L	18 px	1.5	400/500	description text
Body M	16 px	1.5	400/500	default body
Body S	14 px	1.4	400/500	secondary UI
Caption	12 px	1.35	500	labels, meta, helper
Mobile
Token	Size	Line Height	Weight	Usage
Display Mobile	40–48 px	1.0	700	hero
H1 Mobile	30–34 px	1.1	700	page title
H2 Mobile	24–28 px	1.15	700	section
Body Mobile	15–16 px	1.45	400/500	main UI
Caption Mobile	12–13 px	1.35	500	meta
5.3. Typographic rules
Не зловживати all caps у product UI.
Court names — semibold / bold, але без screaming.
Ціни, час, статуси мають бути visually scannable.
У слотах важлива читабельність, а не “дизайнерський характер”.
6. Grid and layout system
6.1. Breakpoints
Breakpoint	Width
Mobile S	360 px
Mobile L	390–430 px
Tablet	768 px
Small Desktop	1024 px
Desktop	1280 px
Wide Desktop	1440 px
6.2. Container widths
Desktop: 1200–1280 px content width
Tablet: 100% - 48px
Mobile: 100% - 32px
6.3. Column system
Desktop
12 columns
24 px gutter
32–40 px outer margins
Tablet
8 columns
20 px gutter
Mobile
4 columns
12–16 px gutter
16 px side padding
7. Spacing system

Use 4px base grid.

Token	Value
space-1	4 px
space-2	8 px
space-3	12 px
space-4	16 px
space-5	20 px
space-6	24 px
space-8	32 px
space-10	40 px
space-12	48 px
space-16	64 px
space-20	80 px
space-24	96 px
Spacing philosophy

Courtly — це не супер-щільний enterprise UI.
В інтерфейсі має бути повітря, але без надлишкового “luxury whitespace”.

Особливо це стосується:

search/filter sections;
court cards;
booking summary;
personal cabinet.
8. Shape language
8.1. Border radius

Лого має округлі, м’які форми — це треба підтримати.

Token	Value	Usage
radius-xs	8 px	small badges
radius-sm	12 px	chips, inputs
radius-md	16 px	cards
radius-lg	20 px	modal, booking panels
radius-xl	28 px	hero containers
radius-pill	999 px	buttons, pills, tags
8.2. Borders

Основний стиль — тонкі, чисті borders.

border: 1px solid #DDDED8;

Для dark blocks:

border: 1px solid #2A2A2A;
8.3. Shadows

Shadows мають бути легкі.

box-shadow: 0 8px 24px rgba(0,0,0,0.06);

Для modal/overlay:

box-shadow: 0 20px 60px rgba(0,0,0,0.18);

Ніяких жирних дропшедоу як у 2019 Dribbble, плз.

9. Product architecture and screen hierarchy

Courtly — це не магазин, а service flow product.

Основні розділи:

Home / Search entry
Search results
list
map
Court detail
Slot selection
Booking confirmation
My bookings
active
past
Favorites
Reviews
Profile / Account
10. UX flow principles
10.1. Primary user flow
Step 1 — Find a court

Користувач:

обирає місто;
обирає район;
бачить список або мапу;
може знайти найближчий корт.
Step 2 — Choose a slot

Користувач:

відкриває сторінку конкретного корту;
бачить доступні дати;
обирає 30-хвилинні слоти;
система не дає забронювати менше 1 години.
Step 3 — Confirm booking

Користувач:

бачить summary;
підтверджує бронювання;
отримує success state.
Step 4 — Manage bookings

Користувач може:

переглядати активні бронювання;
переглядати минулі;
повторити бронювання;
залишити відгук;
додати корт в обране.
11. Page-level design language
11.1. Home page
Purpose

Не “продати бренд”, а швидко закинути людину в бронювання.

Structure
Top header
Hero with search
Featured cities / districts
Nearby courts
Favorites / popular courts
Benefits / how it works
Footer
Hero

Hero повинен бути сильним, але функціональним.

Composition
clean background;
large headline;
короткий subheadline;
prominent search box;
optional tennis-court visual / abstract lines / ball texture.
Example tone
“Знайди корт поруч і забронюй за хвилину”
“Твій теніс — без дзвінків і хаосу”
Hero search block

Основний фокус hero:

city selector;
district selector;
optional date;
CTA “Знайти корт”.

Це має бути найпомітніший блок above the fold.

11.2. Search results page

Це одна з найважливіших сторінок.

Layout

Desktop:

left: filters + list;
right: map.

Або:

top filters;
split-screen map/list below.
Core components
city filter;
district filter;
date filter;
time filter;
price filter;
surface/features filter (optional);
map/list toggle.
Court card

Кожна карточка корту має показувати:

назву;
адресу;
район;
короткий опис;
рейтинг;
ціну від;
вільні години / next available slot;
preview image;
favorite icon.
Visual hierarchy
court name
location
next available / time relevance
price
rating
CTA
Map integration

Map — не decoration, а повноцінний інструмент.

Map behavior
pins show court count or single court;
active pin syncs with active card;
hovering/pressing card highlights pin;
hovering/pressing pin highlights card;
cluster pins on zoom out;
user location button;
“courts near me” quick action.
11.3. Court detail page
Purpose

Допомогти людині відповісти на питання:

чи це мені підходить?
де це?
коли доступно?
скільки коштує?
як швидко забронювати?
Structure
gallery / hero image
court name + rating
address + map preview
court info
slot picker
reviews
similar nearby courts
Must-have info
назва;
адреса;
місто / район;
покриття;
indoor/outdoor;
lighting;
working hours;
price;
правила / note;
фото;
відгуки.
11.4. Slot picker page / block

Це серце всього продукту.

Interaction model
слоти по 30 хв;
мінімум бронювання — 1 година;
значить мінімум треба вибрати 2 adjacent slots.
UI recommendations

Кращий формат:

date selector зверху;
під ним timeline / slot grid;
доступні слоти чітко відрізняються від зайнятих;
selected range очевидно підсвічується.
Slot states
State	Meaning
Available	можна обрати
Hovered	preview selection
Selected start	початок range
Selected middle	середина range
Selected end	кінець range
Unavailable	already booked
Disabled	поза робочими годинами
Past	час у минулому
Color behavior
available: white / light background + thin border;
hover: light lime tint;
selected: lime;
unavailable: muted gray;
selected text: black for high contrast.
Important UX rules
якщо обрано 30 хв — показати clearly, що мінімум 1 година;
якщо користувач намагається взяти 1 слот, система м’яко підказує;
summary має одразу рахувати total duration і total price.
11.5. Booking confirmation page
Purpose

Дати відчуття: все, ти забронював, питання закрите.

Content
success icon / illustration;
court name;
address;
date;
час;
тривалість;
ціна;
booking ID (optional);
CTA:
“Переглянути мої бронювання”
“Повернутись до пошуку”
Tone

Спокійний, чіткий, без зайвої урочистості.

11.6. My bookings
Tabs
Активні
Минулі
Booking card contents
court name;
address;
date;
time;
duration;
status;
quick actions.
Active booking actions
view details;
add to calendar;
repeat booking;
cancel (if business logic allows).
Past booking actions
repeat booking;
leave review;
add to favorites.
11.7. Favorites

Favorites — це saved shortlist, не просто декоративні сердечка.

Page structure
list/grid of liked courts;
filters or sorting;
CTA to open slot picker quickly.
Card extras
“next available”
“book again”
“remove from favorites”
11.8. Reviews
Review system should include:
rating;
short text review;
date;
reviewer name/initials;
maybe tags:
“чистий корт”
“зручне розташування”
“якісне освітлення”
Rules
reviews block should not overshadow booking flow;
summary rating goes near court title;
full review list lower on page.
12. Component system
12.1. Header
Desktop
left: logo;
center: primary nav;
right: profile / bookings / favorites.
Primary nav
Courts
Map
My bookings
Favorites
Header height
72 px desktop
64 px mobile
Style
sticky
clean background
subtle border-bottom
optionally slightly blurred on scroll
12.2. Search bar / filter bar

Це один з core components.

Content
city
district
date
time
search CTA
Visual style
grouped container;
segmented inputs;
strong CTA at right;
responsive collapse on mobile.
Mobile pattern

На мобілці краще:

compact search entry;
bottom sheet / modal for advanced filters.
12.3. Buttons
Primary
lime background
black text
bold label
pill or rounded rectangle
height: 48px;
padding: 0 20px;
border-radius: 999px;
background: #C7E21D;
color: #0B0B0B;
Secondary
white/light gray background
dark text
border
Ghost
transparent
dark text
used for tertiary actions
Destructive
light red background or outlined red
used carefully
12.4. Inputs
Text / select inputs
48–52 px height
12–16 px horizontal padding
radius 12–16 px
subtle border
strong focus state
focus ring: 0 0 0 3px rgba(199,226,29,0.28);
Selects

Good for:

city;
district;
date;
time;
sort.
12.5. Chips / filters

Used for quick filters:

“Поруч зі мною”
“Indoor”
“Відкриті зараз”
“З рейтингом 4.5+”
Style
compact pill;
unselected = light surface;
selected = lime.
12.6. Court cards
Card structure
image
title + favorite icon
address / district
meta row
price / available slot
CTA
Meta examples
Indoor
Clay / Hard
4.8 ★
1.2 km away
Recommended size
Desktop: 320–380 px wide
Mobile: full width or snap cards in horizontal scroll
12.7. Booking summary card

Це дуже важливий sticky компонент на booking step.

Includes
court name
selected date
selected time range
duration
price per hour
total
confirm CTA
Behavior

На desktop може бути sticky right rail.
На mobile — sticky bottom summary bar + expandable sheet.

12.8. Tabs

Used for:

Active / Past bookings
List / Map
About / Reviews / Rules
Style
clean segmented control
active state lime or dark with underline
12.9. Modal / bottom sheet

Use for:

filters on mobile
confirmation dialogs
write review
booking details
Style
rounded top corners
comfortable spacing
obvious close affordance
13. Map design language

Мапа — це одна з головних фіч, тож вона не має виглядати як сторонній iframe, вкинутий абияк.

13.1. Map style
light map theme;
reduced noise;
roads readable;
parks/sports areas visible;
pins very clear.
13.2. Pin design
Default pin
white or black outline
lime center or marker accent
Active pin
full lime fill
slightly larger
maybe subtle pulse
Cluster
dark circle + lime count
або
lime circle + black count
13.3. Interaction
tap pin → preview card;
tap card → center map;
map and list always synchronized.
14. Motion language

Courtly має рухатися швидко й впевнено.

Не sluggish.
Не “плаваючий люкс”.
Не over-animated startup cringe.

14.1. Durations
Interaction	Duration
hover	120–160 ms
button press	80–120 ms
card elevation	180–220 ms
page transition	220–320 ms
modal / sheet open	260–340 ms
map pin emphasis	180–240 ms
14.2. Easing
cubic-bezier(0.22, 1, 0.36, 1)
14.3. Motion examples
favorite icon micro-pop;
slot selection smooth fill;
summary card total updates subtly;
active map pin expands slightly;
tabs slide cleanly.
15. Iconography

Стиль іконок:

outline або semi-filled;
simple geometry;
slightly rounded;
modern, not generic corporate.
Key icons
map pin
clock
calendar
heart
user
star
chevron
location
tennis court / racket (sparingly)
16. Imagery and illustration
16.1. Photography style

Добре працюють:

clean tennis courts;
overhead court shots;
evening light with court texture;
detail shots of net / lines / balls;
urban sports vibe;
people in action — але без перевантаження.
16.2. Usage rules
images support trust and vibe;
they do not interfere with booking clarity;
on product pages — фото кортів must feel real and useful;
no cheesy stock garbage.
16.3. Illustrations

Можуть бути для:

empty favorites;
no results;
success states;
onboarding.

Style:

simple geometric;
black + off-white + lime accents;
not cartoonish.
17. Accessibility
17.1. Contrast
lime on white для дрібного тексту — risky, avoid;
primary text always near-black;
selected slots must still remain readable.
17.2. Touch targets
minimum 44x44 px
especially for:
slots
favorite button
tabs
map controls
17.3. Slot accessibility
unavailable slots should not rely only on color;
add pattern / border / opacity difference;
selected range should be clearly perceivable.
17.4. Keyboard support

Must work for:

date picking
slot navigation
tabs
modals
map/list toggles
18. Content and tone of voice

Courtly має говорити коротко, ясно і без пафосу.

18.1. Voice
direct
modern
helpful
confident
18.2. Good examples
“Знайди корт поруч”
“Доступні слоти”
“Мінімальне бронювання — 1 година”
“Підтверди бронювання”
“Твої активні бронювання”
“Залишити відгук”
18.3. Avoid
“Найкращий сервіс у світі”
“Насолодіться неперевершеним досвідом...”
вода, пафос, рекламний шум.
19. Design tokens draft
:root {
  /* Colors */
  --bg-primary: #F5F5F3;
  --bg-secondary: #ECECE8;
  --surface-primary: #FFFFFF;
  --surface-secondary: #F0F1EC;

  --text-primary: #0B0B0B;
  --text-secondary: #5F6460;
  --text-muted: #8A8F8A;

  --brand-lime: #C7E21D;
  --brand-lime-strong: #B8D615;
  --brand-lime-soft: #EEF6BE;

  --surface-dark: #111111;
  --surface-dark-2: #1A1A1A;

  --border-light: #DDDED8;
  --border-dark: #2A2A2A;

  --success: #2E9D57;
  --warning: #F4B740;
  --error: #D84C4C;
  --info: #2E7DD7;

  /* Typography */
  --font-display: "Sora", sans-serif;
  --font-ui: "Inter", sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Radius */
  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius-pill: 999px;

  /* Motion */
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 140ms;
  --duration-base: 220ms;
  --duration-slow: 320ms;
}
20. Key UI patterns for Courtly
Pattern 1 — Search-first landing

Hero + search module.
Primary goal: швидко перейти до results.

Pattern 2 — Split list/map discovery

Desktop split view.
Primary goal: порівняти локації і швидко вибрати court.

Pattern 3 — Fast slot selection

Grid/timeline with immediate summary.
Primary goal: за 10–20 секунд зрозуміти доступність і забронювати.

Pattern 4 — Sticky booking summary

Постійно видно, що вибрано і скільки це коштує.

Pattern 5 — Dashboard-like personal cabinet

Чисті вкладки: active / past / favorites.

21. Do / Don’t
Do
роби фокус на швидкості бронювання;
тримай інтерфейс чистим;
використовуй lime як smart accent;
роби мапу частиною core UX;
показуй availability дуже чітко;
будь жорстко консистентним у spacing і states.
Don’t
не перетворюй це на e-commerce каталог;
не ховай важливі booking details;
не роби слот-picker занадто “красивим” ціною usability;
не перенасичуй lime;
не використовуй noisy photography;
не роби занадто багато декору в places, де користувач приймає рішення.
22. Final design statement

Courtly combines the energy of tennis with the clarity of a modern booking tool.
Це продукт, де бренд дає характер, а UX дає контроль.

Грубо кажучи:

брендова оболонка = спортивна, смілива, впізнавана;
робоча частина продукту = чиста, структурована, без хаосу;
booking flow = настільки зрозумілий, щоб людина не думала, а просто бронювала.
