# Pilot item set v2

The team's own item set, made with the pseudo-character maker
(`stimuli/tools/pseudo-character-maker/`). It replaces `pilot-draft-v1`.

| Type | Items | IDs |
| --- | --- | --- |
| Real characters | 90 | R001-R090 |
| Pseudo-characters | 37 | P006-P091, with gaps (see below) |

All images are 400 x 400 transparent PNGs rendered in Noto Serif TC by the maker.

## Files

- `items.csv`: one row per item, in the maker's CSV format, plus three columns:
  - `source_file`, `source_item_id`: the team's export file and the item ID in it
    (the team exported several batches, and each batch restarts its IDs at 001).
  - `review_status`: `pending` for every item.
- `images/`: one PNG per item, named by `item_id`.
- `excluded.csv`: pseudo-characters left out, with the reason (`exists_in_unicode` or `team_review`, see below).
- `merge_team_csvs.py`: the script that merged the team's batch exports into `items.csv`
  and copied the images. Usage:
  `python3 merge_team_csvs.py <team folder> <this folder> <batch 2 folder> <batch 3 folder>`,
  where the team folder has `real words/` and `fake words/` with the exported CSVs and the
  renamed PNGs, and each later batch folder (`pseudo-characters 2`, `pseudo-characters 3`) has
  one `items.csv` and its PNGs.
- `items.csv` has the maker's `weight_a` and `weight_b` columns (stroke thickness). They are
  empty for items made before the maker had this setting.

## How the batch exports were matched to the images [Unverified, confidence 85%; the team must confirm]

The team renamed the PNGs to one running number (R001-R090, P001-P065), but the batch CSVs
kept their own IDs. The script's mapping was worked out from the file modification times
(each batch's PNGs share one time) and by looking at every image:

- Real R001-R060: `real words/items_1.csv`, same IDs.
- Real R061-R090: `real words/items_2.csv`, matched by the character shown in each image.
- Pseudo: 71 rows in six batches for 65 images. Later batches hold items that replace earlier
  ones, so six rows are not in `items.csv`:
  - `items_5.csv` replaces `items_1.csv` P008 (脹+辛, now P008 胖+鋅), `items_1.csv` P014
    (祕+晴, now P014, a remake of the same pair) and `items_3.csv` P003 (易+意, now P039 易+煮).
  - `items_6.csv` replaces `items_1.csv` P015 (見+沁, now P015 打+紀), `items_1.csv` P027
    (晴+佔, now P027 趕+項) and `items_1.csv` P031 (干+頁, which formed the real character 頇;
    now P031 靚+蛀).

The full mapping is in the `source_file` and `source_item_id` columns.

## Pseudo-characters that already exist in Unicode (removed)

On 2026-11-18 the team decided to leave out every pseudo-character whose shape is already an
encoded Unicode character, however rare. 30 of the 65 were removed, leaving 35. The script
does this (the `EXCLUDED` list); the team's original images are not changed. Removed IDs are
not reused, so the remaining pseudo-characters keep their IDs and the numbering has gaps.

How they were found: each image's two components were read by eye, and the structure (for
example ⿰月辛) was looked up in cjkvi-ids (https://github.com/cjkvi/cjkvi-ids), allowing
common component variants (for example 王/𤣩, 糹/糸). `excluded.csv` lists each removed item
with the existing character and its code point. Limits [Unverified, confidence 80%]:

- A misread component gives a wrong result either way.
- cjkvi-ids only covers encoded characters. A shape can also be a variant listed in the MOE
  Dictionary of Chinese Character Variants (https://dict.variants.moe.edu.tw/) without being
  encoded, so the remaining items still need the manual check below.

## Removed after team review

On 2026-11-18 the team reviewed the remaining 35 and removed 15 more (the script's
`TEAM_REMOVED` list): P003, P004, P010, P017, P018, P022, P023, P026, P029, P040, P041, P042,
P046, P047, P049. 20 pseudo-characters remain.

## Second batch (2026-11-18)

The team made 15 new pseudo-characters (folder `pseudo-characters 2`). Their file reuses the
IDs P008-P027, so the script gives them new IDs P066-P080 in file order (`source_item_id`
keeps the team's ID). They were checked in the same way as above. Six already exist in
Unicode and were left out (in `excluded.csv`):

| New ID | Team ID | Shape | Existing character |
| --- | --- | --- | --- |
| P068 | P011 | ⿰齒真 | 齻 U+9F7B |
| P071 | P017 | ⿰足刂 | 𧿀 U+27FC0 |
| P072 | P018 | ⿺辶亥 | 𨒨 U+284A8 |
| P073 | P019 | ⿺辶占 | 迠 U+8FE0 |
| P078 | P025 | ⿰言敫 | 譤 U+8B64 |
| P079 | P026 | ⿰皀攵 | 𢼖 U+22F16 (⿰皀攴) |

The other nine were added: P066, P067, P069, P070, P074, P075, P076, P077, P080.

## Third batch (2026-11-18)

The team made 11 more (folder `pseudo-characters 3`, team IDs P001-P016 with gaps). They get
new IDs P081-P091 in file order. Three already exist in Unicode and were left out:

| New ID | Team ID | Shape | Existing character |
| --- | --- | --- | --- |
| P082 | P002 | ⿰阝力 | 阞 U+961E |
| P086 | P008 | ⿸耂占 | 𦒻 U+264BB |
| P087 | P009 | ⿰金屋 | 𫒷 U+2B4B7 |

P081 (語+湖) looks like 䚴 (⿰言月, U+46B4) but has one extra slanted stroke inside 月. The
team confirmed the stroke is meant, so P081 is kept.

The other eight were added: P081, P083, P084, P085, P088, P089, P090, P091.
37 pseudo-characters remain in total.

## Review before the pilot [TBD]

Every item must be checked by a person (see the maker's README). Items to look at first,
found while merging (component readings are from the images and may be wrong):

- P021 (魄+棵, 白+果) is drawn so that its left part looks like 目, which would make it the
  encoded character 𥇬. Kept because 白+果 is not encoded; the team should decide.
- P009 (住 over 灬) looks close to 焦.
- P066 (岏+感) looks very close to 咸: it is 咸 with the first stroke drawn straight down.
  Not found as an encoded character, but readers may take it for 咸.
- P069 (齣+項, ⿰頁句) is the mirror of the encoded character 䪷 (⿰句頁). It also has a small
  leftover stroke above 頁.
- P070 (清+䬤) has a leftover piece at the bottom of 氵, where the left stroke of 尸 was not
  fully erased.
- P089 (霧+緾, 雨 over 厘) has two small stray dots to the left of the character.
- The set has 90 real and 37 pseudo items, not 1:1 [TBD: the team decides the ratio; LEXTALE_CH
  uses 60 real and 30 pseudo in its final test].
