# Pilot item set v2

The team's own item set, made with the pseudo-character maker
(`stimuli/tools/pseudo-character-maker/`). It replaces `pilot-draft-v1`.

| Type | Items | IDs |
| --- | --- | --- |
| Real characters | 90 | R001-R090 |
| Pseudo-characters | 65 | P001-P065 |

All images are 400 x 400 transparent PNGs rendered in Noto Serif TC by the maker.

## Files

- `items.csv`: one row per item, in the maker's CSV format, plus three columns:
  - `source_file`, `source_item_id`: the team's export file and the item ID in it
    (the team exported several batches, and each batch restarts its IDs at 001).
  - `review_status`: `pending` for every item.
- `images/`: one PNG per item, named by `item_id`.
- `merge_team_csvs.py`: the script that merged the team's batch exports into `items.csv`
  and copied the images. Usage: `python3 merge_team_csvs.py <team folder> <this folder>`,
  where the team folder has `real words/` and `fake words/` with the exported CSVs and the
  renamed PNGs.

## How the batch exports were matched to the images [Unverified, confidence 85%; the team must confirm]

The team renamed the PNGs to one running number (R001-R090, P001-P065), but the batch CSVs
kept their own IDs. The script's mapping was worked out from the file modification times
(each batch's PNGs share one time) and by looking at every image:

- Real R001-R060: `real words/items_1.csv`, same IDs.
- Real R061-R090: `real words/items_2.csv`, matched by the character shown in each image.
- Pseudo: 68 rows in five batches for 65 images. Three rows were replaced by remade versions
  in `items_5.csv` and are not in `items.csv`: `items_1.csv` P008 (脹+辛, replaced by P008
  胖+鋅), `items_1.csv` P014 (祕+晴, replaced by P014, a remake of the same pair), and
  `items_3.csv` P003 (易+意, replaced by P039 易+煮).

The full mapping is in the `source_file` and `source_item_id` columns.

## Review before the pilot [TBD]

Every item must be checked by a person (see the maker's README). Items to look at first,
found while merging (component readings are from the images and may be wrong):

- P031 (干+頁) is the real character 頇 (U+9807), which is also real item R041.
- P045 (月+巴 as rendered) looks like the real character 肥.
- Some pseudo-characters are encoded in Unicode (found in cjkvi-ids,
  https://github.com/cjkvi/cjkvi-ids), for example P002 洔, P007 佊, P008 𦛛, P025 𡧟,
  P026 㛡, P033 𨈕, P034 芇, P043 萑, P063 𤡕, P065 𪢪. Check each against the MOE
  Dictionary of Chinese Character Variants (https://dict.variants.moe.edu.tw/).
- P009 looks close to 焦, P054 to 聊, P064 to 朝.
- P015: the right-hand component is cut incompletely.
- P027: strokes are visibly thicker than in the other items.
- The set has 90 real and 65 pseudo items, not 1:1 [TBD: the team decides the ratio].
