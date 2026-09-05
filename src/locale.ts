export type Locale = "auto" | "en" | "ja";

export interface Messages {
  schemaView: string;
  triplesView: string;
  compactTriples: string;
  compactTriplesHint: string;
  compactTriplesActiveHint: string;
  searchPlaceholder: string;
  noResults: string;
  properties: string;
  instances: string;
  relations: string;
  entities: string;
  triples: string;
  legend: string;
  inspector: string;
  statistics: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  fitToScreen: string;
  exportPng: string;
  layout: string;
  close: string;
  parseError: string;
  emptyOntology: string;
  description: string;
  type: string;
  domain: string;
  range: string;
  colorGroup: string;
  declared: string;
  inferred: string;
}

const EN: Messages = {
  schemaView: "Schema",
  triplesView: "Triples",
  compactTriples: "Compact",
  compactTriplesHint: "Fold labels, comments, and standard vocabulary terms into the nodes that reference them.",
  compactTriplesActiveHint: "Compact view is on. Click to show labels, comments, and vocabulary terms as separate nodes.",
  searchPlaceholder: "Search classes, relations, properties…",
  noResults: "No results",
  properties: "properties",
  instances: "instances",
  relations: "Relations",
  entities: "Entities",
  triples: "Triples",
  legend: "Legend",
  inspector: "Inspector",
  statistics: "Statistics",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  resetZoom: "Reset zoom",
  fitToScreen: "Fit to screen",
  exportPng: "Export PNG",
  layout: "Layout",
  close: "Close",
  parseError: "Parse error at line {line}, column {col}: {msg}",
  emptyOntology: "No classes or concepts found in this document.",
  description: "Description",
  type: "Type",
  domain: "Domain",
  range: "Range",
  colorGroup: "Color group {index} of {count} ({size} members)",
  declared: "Declared",
  inferred: "Inferred",
};

const JA: Messages = {
  schemaView: "スキーマ",
  triplesView: "トリプル",
  compactTriples: "簡約",
  compactTriplesHint: "ラベル・コメント・標準語彙の用語を、それを参照しているノードに畳み込みます。",
  compactTriplesActiveHint: "簡約表示が有効です。クリックすると、ラベル・コメント・語彙の用語を個別のノードとして表示します。",
  searchPlaceholder: "クラス・関係・プロパティを検索…",
  noResults: "結果なし",
  properties: "プロパティ",
  instances: "インスタンス",
  relations: "関係",
  entities: "エンティティ",
  triples: "トリプル",
  legend: "凡例",
  inspector: "インスペクター",
  statistics: "統計",
  zoomIn: "拡大",
  zoomOut: "縮小",
  resetZoom: "ズームリセット",
  fitToScreen: "画面にフィット",
  exportPng: "PNG書き出し",
  layout: "レイアウト",
  close: "閉じる",
  parseError: "{line}行目、{col}列目にエラー: {msg}",
  emptyOntology: "このドキュメントにクラスやコンセプトが見つかりません。",
  description: "説明",
  type: "型",
  domain: "ドメイン",
  range: "レンジ",
  colorGroup: "カラーグループ {index}/{count}（{size}メンバー）",
  declared: "宣言済み",
  inferred: "推論済み",
};

export function resolveLocale(locale: Locale): "en" | "ja" {
  if (locale === "en" || locale === "ja") return locale;
  if (typeof navigator !== "undefined") {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith("ja")) return "ja";
  }
  return "en";
}

export function getMessages(locale: Locale): Messages {
  return resolveLocale(locale) === "ja" ? JA : EN;
}
