import csv, shutil, sys, os
src = sys.argv[1]; out = sys.argv[2]
# Folders of the later pseudo-character batches ("pseudo-characters 2", "pseudo-characters 3":
# each one items.csv plus images), in order.
later_dirs = sys.argv[3:]
def rows(p): return list(csv.DictReader(open(os.path.join(src, p), encoding='utf-8-sig')))
real_order2 = '毽鯇氖懿葳玨掂賅蚺綪哏蒿要的是枋輯蒻粵嬡鑫騂酢恬蹔皷萻孖釗閿'
# final pseudo id -> (file, original id); derived from image modification times and a visual check
# of every image. Later batches (items_5, items_6) hold remade items that replace earlier rows.
pmap = {}
for i in [1,7,9,10,13,15,16,17,18,19,20,22,23,24,25,26,27,28,29,30,31]: pmap[i] = ('items_1.csv', i)
for i in [2,3,4,5,6,11,12]: pmap[i] = ('items_2.csv', i)
pmap.update({21: ('items_2.csv', 1), 32: ('items_2.csv', 8), 33: ('items_2.csv', 9), 34: ('items_2.csv', 10), 35: ('items_2.csv', 13), 36: ('items_2.csv', 7)})
i3 = [1,2,3,4,7] + list(range(9, 26))
for k, o in zip(range(37, 59), i3): pmap[k] = ('items_3.csv', o)
pmap.update({8: ('items_5.csv', 1), 14: ('items_5.csv', 2), 39: ('items_5.csv', 4)})
pmap.update({15: ('items_6.csv', 2), 27: ('items_6.csv', 3), 31: ('items_6.csv', 1)})
pmap.update({59: ('items_4.csv', 3), 60: ('items_4.csv', 2), 61: ('items_4.csv', 6), 62: ('items_4.csv', 7), 63: ('items_4.csv', 8), 64: ('items_4.csv', 9), 65: ('items_4.csv', 10)})
assert sorted(pmap) == list(range(1, 66))
# Second batch (2026-11-18): 15 new items. The team's file reuses IDs P008-P027, so they get
# new IDs P066-P080 in file order. IDs are never reused.
BATCH2 = ['P008', 'P010', 'P011', 'P012', 'P014', 'P017', 'P018', 'P019', 'P020', 'P022',
          'P023', 'P024', 'P025', 'P026', 'P027']
# Third batch (2026-11-18): 11 new items, team IDs P001-P016 with gaps; new IDs P081-P091.
BATCH3 = ['P001', 'P002', 'P003', 'P004', 'P006', 'P008', 'P009', 'P010', 'P011', 'P014', 'P016']
LATER = [('pseudo-characters 2', BATCH2, 66), ('pseudo-characters 3', BATCH3, 81)]
assert len(later_dirs) == len(LATER)
assert len(set(pmap.values())) == 65
# Pseudo-characters left out because the shape already exists as an encoded Unicode character
# (team decision, 2026-11-18). Found by reading each image's components and looking up the
# structure in cjkvi-ids (https://github.com/cjkvi/cjkvi-ids). IDs are not reused.
EXCLUDED = {
    'P001': '𫉣', 'P002': '洔', 'P005': '𥬝', 'P007': '佊', 'P008': '𦛛', 'P011': '䯏',
    'P015': '𢩵', 'P024': '𫃠', 'P025': '𡧟', 'P030': '𠰝', 'P033': '𨈕', 'P034': '芇',
    'P036': '𮟫', 'P037': '𡚧', 'P039': '𬊙', 'P043': '萑', 'P045': '肥', 'P048': '㔀',
    'P051': '𨥋', 'P053': '𭦓', 'P054': '聊', 'P056': '𥭋', 'P058': '𫊺', 'P059': '䦦',
    'P060': '𬇏', 'P061': '迌', 'P062': '𠰢', 'P063': '𤡕', 'P064': '𨊸', 'P065': '𪢪',
    # second batch
    'P068': '齻', 'P071': '𧿀', 'P072': '𨒨', 'P073': '迠', 'P078': '譤', 'P079': '𢼖',
    # third batch
    'P082': '阞', 'P086': '𦒻', 'P087': '𫒷',
}
# Pseudo-characters the team removed after reviewing the set (2026-11-18). IDs are not reused.
TEAM_REMOVED = ['P003', 'P004', 'P010', 'P017', 'P018', 'P022', 'P023', 'P026', 'P029',
                'P040', 'P041', 'P042', 'P046', 'P047', 'P049']
cols = ['item_id','lexicality','char','source_a','source_b','structure','cut_a','cut_b','keep_a','keep_b','crop_a','crop_b','move_a','move_b','cut_mode','manual_edit','erase_strokes','layout','place_a','place_b','erase_a','erase_b','weight_a','weight_b','font','image','source_file','source_item_id','review_status']
out_rows = []
r1 = rows('real words/items_1.csv'); r2 = {r['char']: r for r in rows('real words/items_2.csv')}
assert sorted(r2) == sorted(real_order2)
for n, r in enumerate(r1 + [r2[c] for c in real_order2], 1):
    r = dict(r); r['source_file'] = 'real words/' + ('items_1.csv' if n <= 60 else 'items_2.csv'); r['source_item_id'] = r['item_id']
    out_rows.append(r | {'item_id': f'R{n:03d}', 'image': f'R{n:03d}.png'})
pf = {f: {r['item_id']: r for r in rows('fake words/' + f)} for f in ['items_1.csv','items_2.csv','items_3.csv','items_4.csv','items_5.csv','items_6.csv']}
used = set()
for k in range(1, 66):
    f, o = pmap[k]; r = dict(pf[f][f'P{o:03d}']); used.add((f, o))
    r['source_file'] = 'fake words/' + f; r['source_item_id'] = r['item_id']
    out_rows.append(r | {'item_id': f'P{k:03d}', 'image': f'P{k:03d}.png'})
for d, (name, ids, first) in zip(later_dirs, LATER):
    b = {r['item_id']: r for r in csv.DictReader(open(os.path.join(d, 'items.csv'), encoding='utf-8-sig'))}
    assert sorted(b) == ids
    for k, o in enumerate(ids, first):
        r = dict(b[o]); r['source_file'] = name + '/items.csv'; r['source_item_id'] = o
        r['_img'] = os.path.join(d, b[o]['image'])
        out_rows.append(r | {'item_id': f'P{k:03d}', 'image': f'P{k:03d}.png'})
dropped = [(f, i) for f in pf for i in pf[f] if (f, int(i[1:])) not in used]
print('dropped rows:', dropped)
gone = set(EXCLUDED) | set(TEAM_REMOVED)
assert not set(EXCLUDED) & set(TEAM_REMOVED)
excluded = [r for r in out_rows if r['item_id'] in gone]
assert len(excluded) == len(gone)
out_rows = [r for r in out_rows if r['item_id'] not in gone]
with open(os.path.join(out, 'excluded.csv'), 'w', encoding='utf-8-sig', newline='') as fh:
    w = csv.writer(fh, lineterminator='\n')
    w.writerow(['item_id', 'source_a', 'source_b', 'reason', 'existing_char', 'codepoint', 'source_file', 'source_item_id'])
    for r in excluded:
        c = EXCLUDED.get(r['item_id'])
        reason = 'exists_in_unicode' if c else 'team_review'
        w.writerow([r['item_id'], r['source_a'], r['source_b'], reason, c or '', f'U+{ord(c):04X}' if c else '', r['source_file'], r['source_item_id']])
os.makedirs(os.path.join(out, 'images'), exist_ok=True)
with open(os.path.join(out, 'items.csv'), 'w', encoding='utf-8-sig', newline='') as fh:
    w = csv.DictWriter(fh, cols, extrasaction='raise', lineterminator='\n'); w.writeheader()
    for r in out_rows:
        r = {c: (r.get(c) or '') for c in cols}; r['review_status'] = 'pending'; w.writerow(r)
for r in out_rows:
    d = 'real words' if r['item_id'][0] == 'R' else 'fake words'
    shutil.copyfile(r.get('_img') or os.path.join(src, d, r['image']), os.path.join(out, 'images', r['image']))
print(len(out_rows), 'rows')
