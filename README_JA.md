<div align="center">

# 🛠️ Create Your Own Claude Code

**ゼロからAIコーディングアシスタントを構築しよう**

[![GitHub Stars](https://img.shields.io/github/stars/v2ish1yan/create-own-claude-code?style=social)](https://github.com/v2ish1yan/create-own-claude-code/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/v2ish1yan/create-own-claude-code?style=social)](https://github.com/v2ish1yan/create-own-claude-code/network/members)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/v2ish1yan/create-own-claude-code/pulls)

> **8 Modules** | **52 Files** | **11,756 Lines of Code** | **3 Languages Supported**

[中文](README.md) | [English](README_EN.md) | [日本語](README_JA.md)

---

</div>

## 🎯 このプロジェクトは何？

**Claude Code**、**Cursor**、**Copilot CLI** のようなAIコーディングアシスタントがどのように動いているのか、気になったことはありませんか？

このプロジェクトは、**8つの段階的なモジュール**を通じて、LLM APIの呼び出しから完全なAgentシステムまで、ターミナルベースのAIコーディングアシスタントをゼロから構築する**ハンズオンチュートリアル**です。

> 💡 **基本理念**: 各モジュールには実行可能なコード、詳細なコメント、練習問題が含まれています。コーディング80%、読書20%。

<details>
<summary>📖 対象者</summary>

- Node.js / TypeScript の基礎知識があるフロントエンドまたはフルスタック開発者
- AIアプリケーション開発に興味があり、内部仕組みを深く理解したい学習者
- 独自のAIコーディングツールやワークフローを構築したいエンジニア
- AI関連の技術面接に向けて、システムレベルの実践経験が必要な候補者

</details>

<details>
<summary>🎁 何が得られますか？</summary>

- AIコーディングアシスタントのコアアーキテクチャと実装の深い理解
- 自分で構築した拡張可能なターミナルAIコーディングツール
- Tool Calling、Streaming、Agentなどの概念の実践的な経験
- 履歴書やポートフォリオに使える完全なプロジェクト

</details>

---

## ✨ 機能

<table>
<tr>
<td width="50%">

### 🔄 ストリーミング会話
LLMとのリアルタイムストリーミング対話、タイプライター風出力、マルチターンツール呼び出し

</td>
<td width="50%">

### 🔧 ツールシステム
ファイル読み書き、シェル実行、コード検索ツール、権限制御＆パラメータ検証

</td>
</tr>
<tr>
<td width="50%">

### 🎨 ターミナルUI
Ink (React) で構築されたターミナルインターフェース、メッセージバブル、ストリーミング表示

</td>
<td width="50%">

### 🧠 コンテキスト管理
トークン予算配分、コンテキスト圧縮、スライディングウィンドウ、メモリシステム

</td>
</tr>
<tr>
<td width="50%">

### 🤖 Agentシステム
サブエージェントディスパッチ、マルチエージェント協調、タスクオーケストレーション

</td>
<td width="50%">

### 🔌 MCP統合
Model Context Protocol統合、動的ツール発見＆登録

</td>
</tr>
</table>

---

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Entry                          │
│                   (bin/cli.ts)                          │
│            CLI引数解析 & スタートアップ                   │
├─────────────────────────────────────────────────────────┤
│                      UI Layer                           │
│              (ink + React Terminal UI)                  │
│    ターミナルレンダリング / メッセージ / ストリーミング    │
├─────────────────────────────────────────────────────────┤
│                     Tool System                         │
│           (Tool Registry & Pipeline)                    │
│    登録 / 検証 / 実行 / フォーマット                     │
├─────────────────────────────────────────────────────────┤
│                    Service Layer                        │
│          (Agent / Context / Conversation)               │
│   会話管理 / コンテキスト圧縮 / Agent / MCP              │
├─────────────────────────────────────────────────────────┤
│                   Infrastructure                        │
│        (LLM Provider / File System / Shell)             │
│   API通信 / ファイル操作 / プロセス管理 / 設定           │
└─────────────────────────────────────────────────────────┘

    データフロー:  User Input → REPL Loop → LLM API
                       ↑                      ↓
                  Tool Result ← Tool Execution
```

---

## 📚 学習ロードマップ

```
01-LLM通信 ← 02-ツールシステム ← 03-REPLループ ← 04-ターミナルUI
                                                       ↓
            06-Agentシステム ← 08-完全統合 ← 05-コンテキスト管理
                    ↑
            07-MCP統合 ────────────→ 08-完全統合
```

| モジュール | テーマ | 難易度 | 主要技術 |
|:---------:|--------|:------:|----------|
| 01 | [LLM通信基礎](./modules/01-llm-basics/) | ⭐⭐ | SSE Streaming, Tool Calling, Chat Completion |
| 02 | [ツールシステム設計](./modules/02-tool-system/) | ⭐⭐⭐ | Tool Interface, Registry, JSON Schema, Permissions |
| 03 | [REPLインタラクティブループ](./modules/03-repl-loop/) | ⭐⭐⭐ | REPL Loop, QueryEngine, Conversation History |
| 04 | [ターミナルUI (Ink)](./modules/04-terminal-ui/) | ⭐⭐⭐⭐ | Ink, React for Terminal, Yoga Layout |
| 05 | [コンテキスト管理](./modules/05-context-management/) | ⭐⭐⭐⭐ | Token Budget, Compaction, Memory System |
| 06 | [Agent & マルチAgentシステム](./modules/06-agent-system/) | ⭐⭐⭐⭐⭐ | Sub-agent, Swarm Pattern, Task Orchestration |
| 07 | [MCPプロトコル統合](./modules/07-mcp-integration/) | ⭐⭐⭐⭐ | MCP Client/Server, Dynamic Tool Discovery |
| 08 | [完全プロジェクト統合](./modules/08-full-project/) | ⭐⭐⭐⭐⭐ | System Integration, E2E Testing, Optimization |

> 📅 詳細な8週間学習計画は [docs/roadmap.md](./docs/roadmap.md) を参照 — 1日1〜2時間を推奨

---

## 🚀 クイックスタート

```bash
# 1. プロジェクトをクローン
git clone https://github.com/v2ish1yan/create-own-claude-code.git
cd create-own-claude-code

# 2. 依存関係をインストール
npm install

# 3. API Keyを設定
cp .env.example .env
# .envを編集してAPI Keyを入力
# ANTHROPIC_API_KEY=sk-ant-xxxxx

# 4. Module 1から学習開始
cd modules/01-llm-basics
npx tsx src/step1-simple-call.ts
```

<details>
<summary>📋 前提条件</summary>

- **Node.js 18+** — Node.jsランタイムが必要
- **TypeScript** — コアコードはTypeScriptで記述
- **Reactの基礎** — Module 4でReactを使用してターミナルUIを構築
- **API Key** — 少なくとも1つのLLMプロバイダーのAPI Key（Anthropic Claude推奨）
- **CLIの基礎** — ターミナル操作とシェルコマンドに慣れていること

```bash
node -v     # v18.0.0 以上
npm -v      # v9.0.0 以上
```

</details>

---

## 📂 プロジェクト構造

```
create-own-claude-code/
├── README.md                    # プロジェクトドキュメント（中国語）
├── README_EN.md                 # 英語版README
├── README_JA.md                 # 日本語版README
├── docs/
│   └── roadmap.md               # 詳細な学習ロードマップ（8週間計画）
├── modules/
│   ├── 01-llm-basics/           # Module 1: LLM通信基礎
│   │   ├── README.md            #   モジュールガイド
│   │   ├── exercises.md         #   練習問題
│   │   └── src/                 #   実行可能なサンプルコード
│   ├── 02-tool-system/          # Module 2: ツールシステム設計
│   ├── 03-repl-loop/            # Module 3: REPLループ
│   ├── 04-terminal-ui/          # Module 4: ターミナルUI (Ink)
│   ├── 05-context-management/   # Module 5: コンテキスト管理
│   ├── 06-agent-system/         # Module 6: Agentシステム
│   ├── 07-mcp-integration/      # Module 7: MCPプロトコル統合
│   └── 08-full-project/         # Module 8: 完全プロジェクト統合
├── .env.example                 # 環境変数テンプレート
├── package.json
└── LICENSE                      # MIT License
```

---

## 📖 参考リソース

<details>
<summary>📚 公式ドキュメント</summary>

- [Anthropic API Documentation](https://docs.anthropic.com/) — Claude API公式ドキュメント
- [OpenAI API Reference](https://platform.openai.com/docs) — GPTシリーズモデルAPIドキュメント
- [Ink - React for CLI](https://github.com/vadimdemedes/ink) — ターミナルReactレンダリングフレームワーク
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCPプロトコル公式仕様

</details>

<details>
<summary>🔧 オープンソース参考プロジェクト</summary>

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic公式AIコーディングアシスタント
- [Aider](https://github.com/paul-gauthier/aider) — オープンソースAIペアプログラミングツール
- [Continue](https://github.com/continuedev/continue) — オープンソースAIコードアシスタント
- [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter) — オープンソースコードインタープリタ
- [Cline](https://github.com/cline/cline) — VS Codeの自律型コーディングエージェント

</details>

<details>
<summary>💡 学習のヒント</summary>

1. **まず実行** — 各ステップのコードは独立して実行可能。まず実行して効果を確認
2. **次に修正** — パラメータを変更して変化を観察
3. **そして理解** — コメントとREADMEを読んで原理を理解
4. **最後に挑戦** — exercises.mdの練習問題に取り組む

時間が足りない場合は、以下の順序でモジュールを省略できます：
1. Module 4 (ターミナルUI) — console.logで代替可能
2. Module 6 (Agentシステム) — 単一エージェントでも動作可能
3. Module 7 (MCP) — 内蔵ツールで十分

</details>

---

## ⭐ Star History

このプロジェクトが役に立ったら、Starをお願いします！

[![Star History Chart](https://api.star-history.com/svg?repos=v2ish1yan/create-own-claude-code&type=Date)](https://star-history.com/#v2ish1yan/create-own-claude-code&Date)

---

## 📄 License

[MIT](./LICENSE) © 2025 v2ish1yan

このプロジェクトは学習と参考の目的です。Star ⭐、Fork 🍴、PR 🔀 を歓迎します！
