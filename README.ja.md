# ontologyviewer

[English](README.md) · [API](docs/API.md) · [npm公開手順](docs/PUBLISHING.md)

Webページ内のTurtleを、読み取り専用の **Schema** 図と **Triples** グラフとして表示する独立ライブラリです。Cytoscapeを同梱し、サーバー、アカウント、テレメトリ、外部Ontology取得を必要としません。

## クイックスタート

```html
<script type="text/turtle" class="ontologyviewer">
@prefix : <https://example.org/harbor#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Vendor a owl:Class ; rdfs:label "Vendor" .
:Stall a owl:Class ; rdfs:label "Stall" .
:operates a owl:ObjectProperty ;
  rdfs:label "operates" ; rdfs:domain :Vendor ; rdfs:range :Stall .
</script>

<script type="module">
  import ontologyviewer from "https://cdn.jsdelivr.net/npm/ontologyviewer@0.1.0/dist/ontologyviewer.esm.min.mjs";
  ontologyviewer.initialize({ startOnLoad: true });
</script>
```

実行されない `text/turtle` の `<script>` はDOM内に保持され、Viewer稼働中は非表示です。この形式ならTurtleの `<...>` IRIをHTML entityへ変換せず、そのまま記述できます。ただし、Turtle内にリテラルな `</script>` があるとHTMLがsource要素の終了タグとして扱うため避けてください。従来の `<pre class="ontologyviewer">` も利用できますが、HTMLソース内の `<` は `&lt;` と書く必要があります。`destroy()` はどちらのsource要素も元の状態へ戻します。

`examples/` のHTMLをFinderなどから直接開かないでください。ブラウザのES Moduleは `file:` URLでCORSブロックされます。`webplugin/` で `npm run examples` を実行し、`http://127.0.0.1:4173/examples/index.html` を開いてください。直開きや `dist/` 未生成時には、example画面に起動手順が表示されます。

再現性を重視するページでは完全なバージョン（`@0.1.0`）を固定してください。`@10` のようなmajor指定は互換更新に追従できますが、配信内容は将来変化します。

## npmから利用

```bash
npm install --save-exact ontologyviewer@0.1.0
```

```ts
import ontologyviewer from "ontologyviewer";

const manager = ontologyviewer.initialize({
  startOnLoad: true,
  theme: "auto",
  locale: "auto",
});
await manager.ready;
```

## 機能

- datatype property、アイコン、色指定、cardinality、推論関係、統計、凡例、読み取り専用Inspectorを備えたSchemaカード。
- Triples表示、検索、近傍focus、pan、zoom、fit、fCoSE/Dagre、node移動、PNG出力。
- 1ページ内の複数Viewerを完全に分離。
- 英語・日本語UIとlight/darkテーマの自動追従。
- `storageKey` を指定した場合だけ、有効値を検査してレイアウトを `localStorage` に保存。
- Turtleエラーを行・列付きで安全に表示し、`update()` で復旧可能。
- 通常はCSSを自動注入し、制限の強いCSP向けには外部CSSモードを提供。
- 編集機能、ネットワーク通信、telemetry、cookie、アカウントはありません。

## HTML属性

```html
<script
  type="text/turtle"
  class="ontologyviewer"
  data-height="600px"
  data-theme="dark"
  data-locale="ja"
  data-layout="dagre"
  data-default-view="schema"
  data-base-iri="https://example.org/base/"
  data-storage-key="harbor-market"
>...</script>
```

API optionは `data-*` より優先されます。高さには数値付きの `px`、`rem`、`em`、`vh`、`vw`、`%` を指定できます。不正値は安全に `600px` へ戻します。

## プログラムAPI

```ts
const source = document.querySelector<HTMLElement>("#ontology")!;
const instance = ontologyviewer.render(source, {
  baseIri: "https://example.org/base/",
  defaultView: "schema",
  layout: "fcose",
  storageKey: "example-layout", // 省略すると保存しない
  onError(error) {
    console.error(error.line, error.column, error.message);
  },
});

await instance.update(nextTurtle);
instance.fit();
instance.runLayout("dagre");
const png: Blob = await instance.exportPng();
instance.destroy();
```

`initialize()` は `MutationObserver` を登録しません。後から追加した要素は `manager.scan(container)` または `render(element)` で明示的に初期化してください。

完全な型とライフサイクルは [API.md](docs/API.md) を参照してください。

## 厳格なCSPと外部CSS

inline `<style>` が許可されない場合は自動注入を止め、CSSを明示的に読み込みます。

```html
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/ontologyviewer@0.1.0/dist/ontologyviewer.css"
      data-ontologyviewer-styles>
<script type="module" src="/assets/start-ontologyviewer.mjs"></script>
```

```js
import ontologyviewer from "https://cdn.jsdelivr.net/npm/ontologyviewer@0.1.0/dist/ontologyviewer.esm.min.mjs";
ontologyviewer.initialize({ startOnLoad: true, injectStyles: false });
```

Cytoscapeはcanvas配置にstyle属性を使用するため、style要素は外部化したままstyle属性のみ許可します。

```http
Content-Security-Policy: default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://cdn.jsdelivr.net; style-src-attr 'unsafe-inline'; img-src data: blob:
```

外部CSSモードの既定高さは600pxです。このモードで高さを変更する場合は、信頼できるサイト側CSSで `.ontologyviewer-root` を指定してください。

## ベースIRI

相対IRIは次の順で解決します。

1. `options.baseIri`（非推奨alias `baseIRI` も利用可能）
2. `data-base-iri`
3. Turtle内の `@base`
4. `document.baseURI`

0.1.xが直接解析する形式はTurtleだけです。RDF/XML、JSON-LD、TriG、N-Triples、Notation3は自動判定しません。

## 対応ブラウザ

ESM bundleはES2020をtargetとし、CIでPlaywright Chromium、Firefox、WebKitを実行します。Chrome/Edge、Firefox、Safariの最新2安定版をsupport対象とします。

## 開発・公開

`webplugin/` は自己完結しています。内容を新しいrepositoryのrootへコピーしても、次の手順で検証できます。

```bash
npm ci
npx playwright install chromium firefox webkit
npm run verify
npm run test:e2e
npm pack
```

- [導入](docs/GETTING_STARTED.md)
- [API](docs/API.md)
- [カスタマイズとCSP](docs/CUSTOMIZATION.md)
- [トラブルシューティング](docs/TROUBLESHOOTING.md)
- [開発](docs/DEVELOPMENT.md)
- [npm/jsDelivr公開](docs/PUBLISHING.md)
- [Security](docs/SECURITY.md) · [Privacy](docs/PRIVACY.md)
- [Contribution](CONTRIBUTING.md) · [変更履歴](CHANGELOG.md)

## ライセンス

MITです。同梱依存のnoticeは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にあります。
