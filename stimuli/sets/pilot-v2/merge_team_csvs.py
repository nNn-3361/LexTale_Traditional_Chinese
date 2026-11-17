import csv, shutil, sys, os
src = sys.argv[1]; out = sys.argv[2]
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
assert len(set(pmap.values())) == 65
cols = ['item_id','lexicality','char','source_a','source_b','structure','cut_a','cut_b','keep_a','keep_b','crop_a','crop_b','move_a','move_b','cut_mode','manual_edit','erase_strokes','layout','place_a','place_b','erase_a','erase_b','font','image','source_file','source_item_id','review_status']
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
dropped = [(f, i) for f in pf for i in pf[f] if (f, int(i[1:])) not in used]
print('dropped rows:', dropped)
os.makedirs(os.path.join(out, 'images'), exist_ok=True)
with open(os.path.join(out, 'items.csv'), 'w', encoding='utf-8-sig', newline='') as fh:
    w = csv.DictWriter(fh, cols, extrasaction='raise', lineterminator='\n'); w.writeheader()
    for r in out_rows:
        r = {c: (r.get(c) or '') for c in cols}; r['review_status'] = 'pending'; w.writerow(r)
for r in out_rows:
    d = 'real words' if r['item_id'][0] == 'R' else 'fake words'
    shutil.copyfile(os.path.join(src, d, r['image']), os.path.join(out, 'images', r['image']))
print(len(out_rows), 'rows')
