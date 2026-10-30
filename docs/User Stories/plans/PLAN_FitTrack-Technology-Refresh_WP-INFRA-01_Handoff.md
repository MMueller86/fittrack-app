# WP-INFRA-01 Handoff: Runtime-, lokale CLI- und Release-Dokumentation

Stand: 2026-10-30. Agent: Infrastructure. Keine schreibende Azure-/EAS-Operation, kein Deploy, kein Commit.

## Ergebnis

`PASS` für die Repository-/Dokumentationsarbeit. Lokale CLI-Aktualisierung bewusst nicht ausgeführt (Auftrag: nur dokumentieren).

## 1. Azure Runtime / Health-Baseline (lesend)

| Prüfung | Ergebnis |
|---|---|
| `infra/modules/functionapp.bicep` | `functionAppConfig.runtime`: `node` / `24` (Zeilen 133–134), `minTlsVersion: 1.2` |
| `az functionapp show` (Alpha `func-fittrack-alpha-wcobsd`) | `kind: functionapp,linux`; das Feld `runtime` liefert die installierte CLI als `null` (CLI-Schema) – Runtime daher aus Bicep und `what-if` belegt |
| `what-if` (WP-INFRA-02) | keine Änderung an `functionAppConfig.runtime` → Live-Wert entspricht `node` / `24` |
| `az functionapp scale config show` | `maximumInstanceCount` 5, `instanceMemoryMB` 2048; `alwaysReady` `null` (nicht gesetzt = 0) |
| `GET /api/diary/meals` ohne Token | HTTP 401 (erwartet) |
| `GET /api/health` (anonym) | HTTP 200 |

Keine Runtime-Mutation.

## 2. Lokale Toolchain

| Tool | Lokal | Referenz | Bewertung |
|---|---|---|---|
| Node | 24.22.1 | Zielstand | ok |
| npm | 12.2.1 | Zielstand | ok |
| Functions Core Tools | **4.9.0** | CI und Registry `4.16.0` | veraltet; nicht geändert |
| EAS CLI | **21.6.0** | Registry `latest` = **27.2.0** (Plan nannte 26.x); `engines.node` `^20.18.3 \|\| >=22.0.0`; `eas.json` verlangt `>= 3.0.0` | veraltet; nicht geändert |
| Azure CLI | 2.85.0 | – | ok; Bicep CLI 0.42.1 (neu: 0.48.1) |

Installationshinweise (vom Operator auszuführen, nicht ausgeführt):

```powershell
npm install -g --allow-scripts=azure-functions-core-tools azure-functions-core-tools@4.16.0
npm install -g eas-cli@26   # oder @latest (27.2.0) nach PO-Entscheidung
```

Hinweis: Mit npm 12 ist `--allow-scripts=azure-functions-core-tools` Pflicht (siehe WP-BE-07-Handoff: Installation in temporärem Prefix mit dem Flag → `func` 4.16.0).

## 3. Dokumentation auf Aktualität geprüft

| Datei | Befund | Änderung |
|---|---|---|
| `README.md` | Node „v20.x“, npm „10.x“, Core Tools unpinned | Node 24.x / npm 12.x, Core Tools `@4.16.0` |
| `backend/README.md` | Node 20 LTS, `func` „4.x“ | wie oben |
| `infra/README.md` | `--allow-scripts`/Gates fehlten | Abschnitte „Release Gates“ und „Bicep API Versions“ |
| `.github/instructions/infra-release.instructions.md` | kein Toolchain-Stand, kein getrenntes Gate, `android/`-Zeile ohne gitignore-Hinweis | Abschnitte „Operator Toolchain“ und „Release Gates“; Dev-Build-Hinweis Expo 58 |
| `docs/kb/tech/07-infrastructure.md` | – | nur API-Versionen (siehe WP-INFRA-02) |
| `.vscode/tasks.json`, `.vscode/settings.json` | **nicht versioniert** (`git ls-files .vscode` leer) | nicht geändert |

Befehle `func azure functionapp publish … --build remote --javascript` und `eas build --profile preview --platform android --non-interactive` sind weiterhin gültig.

## 4. Release-Fakten (dokumentiert)

- Deploy-Gate (Bicep-Apply, `func publish`) und EAS-Gate sind getrennte Freigaben.
- Nach dem Expo-58-Upgrade: `Dev Build Required: YES` (native Pakete geändert).
- `mobile/android/` ist gitignored; nativer Layer entsteht per EAS prebuild.

## Offene Punkte

1. **[Open]** EAS-CLI-Zielversion: Plan 26.x, Registry `latest` 27.2.0 – PO entscheidet.
2. Lokale Installation von Core Tools 4.16.0 / EAS CLI durch den Operator (nicht ausgeführt).
3. Lokale, unversionierte Release-Tasks in `.vscode/tasks.json` und `%TEMP%\fittrack-alpha-release.ps1` prüfen sich außerhalb des Repos: der Task prüft Handler `instagramRecipe` (laut Release-Anweisung heißen die Funktionen `recipes-render-instagram`/`recipes-share-bundle`) und führt EAS im selben Lauf aus (widerspricht dem getrennten EAS-Gate). Nicht geändert, da nicht im Repo.
