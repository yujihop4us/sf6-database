import json, os, urllib.request

url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Tier S と Tier A を取得（earnings降順）
params = "select=id,handle,tier,bio,bio_en,total_sf6_earnings_usd&tier=in.(S,A)&order=tier.asc,total_sf6_earnings_usd.desc"
req = urllib.request.Request(
    f"{url}/rest/v1/players?{params}",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    },
)
rows = json.loads(urllib.request.urlopen(req).read())

missing = []
print(f"{'Tier':<5} {'ID':<5} {'Handle':<20} {'bio_jp':<10} {'bio_en':<10}")
print("-" * 55)
for r in rows:
    has_jp = "OK" if r.get("bio") and len(r["bio"].strip()) > 0 else "MISSING"
    has_en = "OK" if r.get("bio_en") and len(r["bio_en"].strip()) > 0 else "MISSING"
    print(f"{r['tier']:<5} {r['id']:<5} {r['handle']:<20} {has_jp:<10} {has_en:<10}")
    if has_jp == "MISSING" or has_en == "MISSING":
        missing.append(r)

print(f"\n--- Summary ---")
print(f"Total: {len(rows)} players (Tier S + A)")
print(f"Complete: {len(rows) - len(missing)}")
print(f"Missing bio: {len(missing)}")
if missing:
    print("\nPlayers still missing a bio:")
    for m in missing:
        jp = "JP" if not (m.get("bio") and len(m["bio"].strip()) > 0) else ""
        en = "EN" if not (m.get("bio_en") and len(m["bio_en"].strip()) > 0) else ""
        print(f"  ID {m['id']} {m['handle']} - missing: {' '.join(filter(None, [jp, en]))}")
else:
    print("\nAll bios are filled!")
