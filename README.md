# sonic-mystic

Huyền học for Sonic Hub — Tử vi from grandma's notes now; chiêm tinh, nhân số học, Kinh Dịch and tarot later.

| folder | what |
|---|---|
| `engine/` | pure TypeScript computation (lunar calendar, an sao, hạn, the rule language), shared by the API and the web |
| `kb/` | the knowledge pipeline: grandma's text → `kb/bundle/` (book, rules, supplement) that the API imports |
| `api/` | NestJS + Drizzle on its own Postgres database `mystic`; owns the knowledge, people, profiles and AI readings |
| `web/` | the Huyền học web (Vite + React); it only shows what the API reads |
| `deploy/` | Dockerfiles for the API and the web (build from the repository root) |

Grandma's words ("lời bà", source kind `family`) and everything added to them ("bổ sung": other books, AI) are kept
apart all the way through: in the tables, in the API and on every page.

```sh
npm ci
npm test                         # needs TEST_DATABASE_URL for the API tests
DATABASE_ADMIN_URL=postgresql://… MYSTIC_DB_PASSWORD=… npm start   # creates the database on first start
npm run dev:web                  # /api goes to http://localhost:3100
```
