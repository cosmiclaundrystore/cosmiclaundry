# Adding a new batch of tees

A batch is a zip of tee mockups: new Laundries, new tees in existing Laundries, or both.
Each batch lands in two places:

| What | Where | Why |
|---|---|---|
| Names, descriptions, Laundries, prices, colours, sizes | Supabase (database) | The site reads the catalog from here; you can edit it any time in the Table Editor |
| Product photos (`<id>-black.webp`, `<id>-white.webp` + `-480` thumbnails) | `public/assets/products/` (deployed with the site) | Served from Vercel's CDN. Moves to Supabase Storage with the admin (Phase 5) |

## The easy way: give Claude the zip

Say "add this batch" with the zip path. Claude will unpack it, sort designs into Laundries,
read titles off the artwork where the file names don't have them, process the photos, add everything
to Supabase and show it to you on the local site. It will ask before guessing anything important.

The zip is easiest to work with when it follows these conventions (not required, just faster):

```
my batch.zip
├── One Piece/                  ← one folder per Laundry (folder name = Laundry name)
│   ├── Black/01 - Gear Five-Black.png
│   └── White/01 - Gear Five-White.png
├── Anime/                      ← a group folder is fine; each show inside becomes its own Laundry
│   ├── Bleach/Aizen - You Saw What I Allowed-Black.png
│   └── Bleach/Aizen - You Saw What I Allowed-White.png
└── notes.txt                   ← optional, see below
```

- **Two files per design**: one ending `-Black`, one ending `-White`.
- **Name files after the title you want on the site** (`Character - Title` is great). A number prefix
  like `01 - ` sets the order and is dropped from the name.
- **Mockups**: transparent PNGs work best. White backgrounds (even with a floor shadow) are cut out
  automatically. Any size works; tees are resized to match the rest of the shop.
- **Adding to an existing Laundry**: name the folder exactly like it (for example `Jujutsu Kaisen`).
- **notes.txt** (optional): anything that isn't obvious, for example
  `Price: 3900 LKR`, `Featured in One Piece: Gear Five`, `Default colour for Bleach: white`,
  `Tagline for One Piece: Set sail.`

Defaults when nothing is said: 3,499 LKR / £19.99 / $24.99, black shown first, sizes S–XXL, first design is the Laundry's featured tee.

## Doing it yourself

1. **Write a manifest** in `batches/<name>.json` (copy `batches/set-3.json`): each Laundry with its
   id, name, tagline, description, featured tee, colours (`tint`, `accent`), and its tees with
   `id`, `name`, `description`, `defaultColor` and the two source images.
   Add `"showOnHome": false` to a Laundry to keep it off the home page strip (like Custom).
   For an existing Laundry add `"existing": true` and list only the new tees.
2. **Make the photos**:
   ```bash
   python3 scripts/batch/prepare_tee_images.py batches/<name>.json "/path/to/unzipped batch"
   ```
   It prints one line per tee. Look at any line that says `check it`.
3. **Make the SQL**:
   ```bash
   node scripts/batch/generate_batch_sql.mjs batches/<name>.json > supabase/migrations/$(date +%Y%m%d%H%M%S)_add_<name>.sql
   ```
4. **Add it to Supabase**:
   ```bash
   npx supabase db push
   ```
   If a tee or Laundry id already exists, nothing is added and you get an error naming it.
5. **Check it**: `npm run dev`, open http://localhost:3000/laundries. New tees show up within a minute
   (restart `npm run dev` to see them immediately).
6. **Ship it**: commit `public/assets/products/`, the manifest and the migration, then deploy.

## Changing things later

- **Price, name, description, order**: Supabase → Table Editor → `products` / `product_prices`
  (`amount_minor` is in cents: 390000 = 3,900 LKR). Live within a minute.
- **Hide a tee**: set `is_active` to false in `products`. Hide a Laundry the same way in `collections`.
- **Replace a photo**: overwrite the `.webp` files in `public/assets/products/` and deploy.
