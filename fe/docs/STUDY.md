# Study — Flashcards (/study)

Module học từ vựng tiếng Anh, lưu dữ liệu trên PostgreSQL (theo user đăng nhập).

## Routes

| Route | Mô tả |
|-------|--------|
| `/study` | Dashboard + heatmap |
| `/study/lists/:listId` | Chi tiết list |
| `/study/lists/:listId/review` | Ôn tập SRS |
| `/study/lists/:listId/random` | Xem ngẫu nhiên |
| `/study/manage` | CRUD list |
| `/study/manage/:listId` | CRUD từ |

## API

Prefix: `/api/study` (Bearer token)

### Import copy/paste (STUDY4 format)

`POST /api/study/manage/lists/:listId/words/import-paste`

Body: `{ "rawText": "..." }`

Parser nhận dạng:
- `word (pos) /ipa/` (+ dòng UK/US tuỳ chọn)
- `Định nghĩa:` + nghĩa VI + dòng `=nghĩa EN`
- `Ví dụ:` + câu có `[word]` → chuyển thành `_____` + `(=Dịch: ...)`

## Mobile

UI tối ưu iPhone 15 Pro (393×852) và iPhone 12 Pro (390×844): safe-area, touch 44px, bottom nav.

## DB setup

```bash
cd be
npx prisma migrate deploy
npx prisma db seed
```

Bảng: `StudyWordList`, `StudyWord`, `StudyUserWord`, `StudyWordProgress`, `StudyListEnrollment`, `StudyUserSettings`, `StudyDailyActivity`, `StudyHiddenList`, `StudyHiddenWord`, `StudyWordOverride`, `StudyListMetaOverride`.
