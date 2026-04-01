# SF6 Database — Player Bio ライティングガイド v3.1（2026-03-21）

## 対象
S tier 13名（完了）、A tier 約90名（75名未着手）。A tierは賞金額降順で優先。

---

## 執筆ルール

**言語**: JP (bio) と EN (bio_en) は翻訳ではなく、それぞれの言語で自然に書く。

**トーン**: ポジティブ〜中立。プロレス的な煽り・盛り上げOK。ネガティブ事案（スキャンダル、炎上等）は除外。読み物として面白く、その選手のファンになってもらうことを目指す。

**構成**:
- 冒頭にプロフィール概要（本名、生年月日、国籍、チーム、使用キャラ、一言紹介）
- 前半：キャリアストーリーを ■ サブタイトル で区切って記述。「第1章」「Chapter 1」等のナンバリングは不要。サブタイトルそのものがキャッチーで内容を端的に表すものにする（例：「"持ってない男"からCapcom Cup王者へ」「パワーのNL——攻撃こそ最大の防御」）。
- 後半：面白エピソード・ミーム・名言セクション。「■ エピソード＆ミーム」等の仕切りを1つ入れてから、各エピソードを ■ サブタイトル で独立させる。ミーム化した出来事、コミュニティで語り継がれるネタ、人柄が伝わるエピソードを優先。

**必須項目**: 本名、生年月日、国籍、チーム、SF6使用キャラ、SFL参加情報（該当する場合）。

**推奨項目**: キャリア原点、転機となったエピソード、ミーム、ニックネーム由来、プレイスタイルの特徴。

**文字数目安**: JP 800〜2500字、EN 500〜1800字。選手の知名度・エピソード量に応じて調整。

**追記内容（ライティングガイド v3.2）**：

文字数ガイドラインの扱い JP 800〜2500字、EN 500〜1800字はあくまで目安とする。プレイヤーのバックストーリー、人間関係、動機、コミュニティにおける意味など——「なぜこの人は戦い続けているのか」が伝わる物語の密度を最優先し、それを満たすために文字数が超過することは問題としない。逆に、物語性の薄い戦績羅列で文字数を埋めることは避ける。また戦績以上に、配信や大会などで人気の選手に関しては、後半のセクションを充実させる。

**追記内容（ライティングガイド v3.3）**：

バイオの構成ルール 前半はプレイヤーの正統なバイオグラフィーとする。出自、格ゲーとの出会い、キャリアの転機となった大会・移籍、現在の立ち位置を物語として描く。トーンはしっかりとした読み物。 後半にエピソード・ミームセクションをまとめる。面白い逸話、コミュニティでの印象的な言動、配信での名場面、愛称の由来などをここに集約する。前半の物語パートにミームやネタを混ぜ込まない。

**賞金額の扱い（重要）**: bio本文中に賞金総額・具体的な賞金額は一切記載しない。賞金は total_sf6_earnings_usd カラムで別枠UI表示するため、変動する数値をbioにハードコードしない。「大会で好成績を収めた」「優勝」等の表現はOK。

**サブタイトルの書き方**:
- 「■ 」に続けてキャッチーな短文。ナンバリング（第1章、Chapter 1等）は使わない。
- キャリア部分の例：「■ ゲーセン育ちのRyu使い、世界へ」「■ SF6で爆発——Lukeとの出会い」
- エピソード部分の例：「■ 嫁バフ——CC11最大の隠しスキル」「■ ケーキにキムチを巻いて食べる男」
- ENも同様：「■ The JP Awakening」「■ Cake with Kimchi」

**エピソード・ミームの質**: ミーム化した出来事、コミュニティ内で語り継がれるエピソード、本人の人柄・キャラクター性が伝わるネタを優先。薄い内容で数を増やすより、面白いものだけを厳選する。外国人選手でもリサーチして必ず何か入れる。

---

## DB検索方法

### テーブル構造（主要カラム）
Copy
id, handle, real_name, bio, bio_en, tier, team, team_logo_url, main_character, sub_characters, country_code, birth_date, total_sf6_earnings_usd, liquipedia_url, twitter_handle, esports_earnings_id, startgg_player_id, startgg_player_ids, controller_type, controller_device, epithets, active_since, profile_image_url, cc12_group, created_at


※ `name` カラムは存在しない。本名は `real_name` を使用。

### 環境変数
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
バイオ未入力の選手を賞金順で取得（推奨：Python側フィルタ方式）
PostgREST の bio=is.null や bio=eq. は 400 エラーになる場合があるため、 全件取得 → Python側で not p.get("bio") フィルタが最も安定する。

Copypython3 << 'PYEOF'
import urllib.request, json, os

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

url = (
    f"{SUPABASE_URL}/rest/v1/players"
    "?tier=eq.A"
    "&select=id,handle,bio,real_name,main_character,total_sf6_earnings_usd,team"
    "&order=total_sf6_earnings_usd.desc.nullslast"
    "&limit=100"
)

req = urllib.request.Request(url, headers={
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode())

empty = [p for p in data if not p.get("bio")]

print(f"A-tier total: {len(data)} / bio empty: {len(empty)}\n")
print(f"{'#':>3} {'ID':>5}  {'Earnings':>10}  {'Handle':20s}  {'Main':15s}  {'Team':15s}")
print("-" * 80)
for i, p in enumerate(empty[:30], 1):
    earn = p.get("total_sf6_earnings_usd") or 0
    main = p.get("main_character") or ""
    team = p.get("team") or ""
    print(f"{i:>3} {p['id']:>5}  ${earn:>9,.0f}  {p.get('handle',''):20s}  {main:15s}  {team:15s}")
PYEOF

tier を変えて検索する場合
?tier=eq.A を ?tier=eq.S や ?tier=eq.B に変更するだけ。

特定選手のバイオ確認
Copyurl = f"{SUPABASE_URL}/rest/v1/players?id=eq.{PLAYER_ID}&select=id,handle,bio,bio_en"
複数IDを一括確認
Copyids = [1, 14, 15, 28, 39]
ids_str = ",".join(str(i) for i in ids)
url = f"{SUPABASE_URL}/rest/v1/players?id=in.({ids_str})&select=id,handle,bio,bio_en"
DB更新方法
Supabase REST API に SERVICE_ROLE_KEY で PATCH。anon key では RLS により書き込み不可。

Copyimport urllib.request, json, os
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def update_bio(player_id, bio_jp, bio_en):
    body = json.dumps({"bio": bio_jp, "bio_en": bio_en}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/players?id=eq.{player_id}",
        data=body, method="PATCH", headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        })
    urllib.request.urlopen(req)
    print(f"Updated player {player_id}")
参考bio（構成テンプレート）
[プロフィール概要 — 本名、生年月日、国籍、チーム、キャラ、一言紹介]

■ [キャリアサブタイトル1]
本文...

■ [キャリアサブタイトル2]
本文...

■ [キャリアサブタイトル3]
本文...

——エピソード＆ミーム——

■ [エピソードサブタイトル1]
本文...

■ [エピソードサブタイトル2]
本文...

bio完成後は、必ず cat << 'PYEOF' > update_{handle}.py ... PYEOF + python3 update_{handle}.py のワンライナー形式で出力する。環境変数は NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY（NEXT_PUBLIC_なし）。セッションリセットされても、ユーザーがターミナルにコピペ → 即実行でDB書き込み完了できる状態にする。

日本語テキスト内の全角ダブルクォート " " をすべて 『』（二重山括弧）に置換しました。これでPythonの文字列リテラルのダブルクォート " と衝突しなくなります。英語側のエムダッシュ — も -- に統一し、シングルクォートはそのまま問題なく通ります。