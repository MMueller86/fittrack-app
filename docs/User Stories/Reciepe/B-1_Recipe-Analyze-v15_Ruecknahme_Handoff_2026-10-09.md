# B-1 Recipe Analyze v15 Ruecknahme Handoff

Datum: 2026-10-09. Freigabe: ausdrueckliches v15 approve laut Task Package.
Status: belegbare Teilruecknahmen ausgefuehrt; uneindeutige Teilhunks ausgesetzt. Kein behaupteter Stabilitaetsfix, keine vollstaendige v13-Wortlautrekonstruktion, kein Plan-/QA-PASS.
Scope: ausschliesslich v15 B-1. Kein Git-Revert, keine Datei aus HEAD restauriert, kein Deployment, keine spaeteren Pakete umgesetzt, kein full-plan Lesen.

## Unveraenderte Ausgangsevidenz

Vor dem ersten B-1-Codeedit wurden git status --short, git diff --stat und der vollstaendige Diff fuer die fuenf geforderten Backend-Kontextdateien erfasst. Ausgangsstatistik laut urspruenglichem Handoff: 14 tracked Dateien, 703 insertions, 38 deletions. Status/Statistik sind hier historische Angaben, keine erneut erzeugten Originalausgaben. Der damalige vollstaendige Dateidiff ist jetzt unveraendert im Repository gesichert und wird nicht durch den Enddiff ersetzt.

### Repository-Evidenzmanifest

Ergaenzung am 2026-10-09: ausschliesslich Evidenzsicherung/Dokumentation, keine neuen Code-/Testedits, Pakete oder Gatewiederholungen. Vollstaendige Repositorypfade relativ zum Workspace-Root:

| Artefakt / Repositorypfad | Inhalt / Herkunft | SHA-256 der Artefaktbytes |
|---|---|---|
| [docs/User Stories/Reciepe/B-1_Recipe-Analyze-v15_Ausgangsdiff_2026-10-09.txt](B-1_Recipe-Analyze-v15_Ausgangsdiff_2026-10-09.txt) | Bytegleiche Uebernahme des noch lesbaren Original-Toolartefakts `copilot-terminal-output-9c6bc3bd-5033-4b35-a73d-367757840a91.txt`; vor B-1 erfasster HEAD-gegen-Worktree-Diff aller fuenf Kontextdateien, inklusive damaliger Warnzeilen und unveraenderter Fixtureevidenz. Kein nachtraeglich erzeugter Originaldiff. | `07FF1F0B20DE4D6590E0D7647975FA92414189FA71174D10B54F24C22CEBC767` |
| [docs/User Stories/Reciepe/B-1_Recipe-Analyze-v15_Enddiff_2026-10-09.patch](B-1_Recipe-Analyze-v15_Enddiff_2026-10-09.patch) | Neu gesicherter HEAD-gegen-Worktree-Diff der vier B-1-Dateien nach Ruecknahme. Erzeugt mit `git -c core.quotepath=false diff --no-ext-diff --no-color` und genau diesen vier Pfaden. Enthaelt auch erhaltene vorbestehende Arbeit; nicht mit dem B-1-Aenderungsumfang gleichzusetzen. | `76D9DFF2C42C47A5E4F6A82094B06DD596DD4BBD969242874F614A9C2FB05082` |
| [docs/User Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch](B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch) | Nachtraeglich abgeleiteter Vorher-gegen-Nachher-Diff, nur B-1: Ausgangsstaende aus Originalhunks und passender Git-Basis rekonstruiert, gegen aktuellen Endstand verglichen. Kein historisch erfasster Editdiff und keine v13-Rekonstruktion. | `F61A4FB4CB75DF84BA82ECA9E43C2EEDDEEB2090E780338F12E5CDABB0DEB5AB` |
| [docs/User Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md](B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md) | Dieses Manifest, Herkunftsabgleich, Hunkmatrix, historische Gatebefunde und offene Grenzen. Kein Selbsthash, um zyklische Hashdefinition zu vermeiden. | Siehe Hashes der verlinkten Evidenzdateien. |

Alle Originalhunks beziehen sich auf die passende Git-Basis des aktuellen HEAD `b637ee5b59a4f72b7d822443680c1951a01f9dc4`. Bei der Sicherung wurde fuer jede der vier Dateien der Basisblob gegen die linke `index`-ID des Originaldiffs geprueft. Anschliessend wurden die Originalhunks ohne Fuzz auf diesen Basistext angewandt; Kontext und Hunklaengen stimmten exakt. Der rekonstruierte Vorhertext ergab jeweils die rechte `index`-ID. Der Enddiff wurde separat mit einem frisch erzeugten Diff verglichen. Alle Vergleiche bestanden. Die Pfadheader des abgeleiteten Ruecknahmediffs wurden auf die Repositorypfade gesetzt; keine inhaltliche Nachbearbeitung der Hunks.

### Vorher-/Nachher-Hunks

Die exakten Zeilen samt Kontext stehen selbststaendig im Ruecknahmediff. `-` bezeichnet den belegten v14-Ausgangsstand vor B-1, `+` den gesicherten v15-Endstand. Logische Teilhunks innerhalb derselben Git-Hunk sind hier getrennt aufgefuehrt:

| Datei / Teilhunk | Belegtes Vorher -> Nachher | Einordnung |
|---|---|---|
| [backend/src/lib/prompts/recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts), Version | `RECIPE_ANALYZE_PROMPT_VERSION = 'v14'` -> `'v15'` | Bewusste v15-Version, keine historische Rueckdatierung. |
| Dieselbe Datei, steps-Einleitung | `genau min(N, ${RECIPE_EXPORT_MAX_STEPS}) Exportschritte fuer N Quellschritte` -> Hoechstens-fuenf-Einleitung | Exakter Originalwortlaut mit Umlauten und Templateausdruecken im Diff; separate exakte Mappingregel bleibt. |
| Dieselbe Datei, steps-Planung | Planung ausschliesslich nach Zuordnung und anschliessende Uebernahme -> fruehere Hoechstens-fuenf-Abschnittsplanung bei mehr als fuenf Ausgangsschritten | Nur dieser Teil ersetzt; Checkliste und Beilagen-/Serviersemantik im selben Absatz erhalten. |
| Dieselbe Datei, Zuordnung erster Absatz | N=5-Beispiel mit Garen/Servieren, `[5,5]` und zusaetzlichem `[5]` -> entfernt | Uebriger Absatz bytegleich auf LF-Textebene, insbesondere die ausgesetzten gemischten Saetze; N=8-Beispiel bleibt. |
| Dieselbe Datei, Gruppenabsatz | Verbot weiterer Eintraege fuer zweite Handlung, gemeinsame Beschreibung und Platzmangelregel -> entfernt; `Wiederhole oder ueberspringe keine Order` bleibt als eigener Satz | Partition, Reihenfolge und Semantikerhaltung bleiben. |
| [backend/src/lib/prompts/recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts), Guard | `TESTED_PROMPT_VERSION = 'v14'` -> `'v15'` | Einzige B-1-Aenderung in dieser Datei. Count-/Order-/Semantikassertions bleiben. |
| [backend/src/lib/openai.ts](../../../backend/src/lib/openai.ts), analyzeRecipeText | `temperature: 0` -> `temperature: 0.2` | Einzige B-1-Aenderung; Endstand ist inhaltlich HEAD-identisch, deshalb kein Abschnitt im HEAD-Enddiff. Beide Seiten stehen im Ruecknahmediff. |
| [backend/src/functions/ai.test.ts](../../../backend/src/functions/ai.test.ts), Requestassertion | `temperature: 0` -> `temperature: 0.2` | Einzige B-1-Aenderung; Modell, Tokenbudget, Strict Schema und erhaltene Tests unveraendert. |

### Inhaltsidentitaet der vier Staende

Git-Blob-IDs (SHA-1, nicht SHA-256) beziehen sich auf LF-normalisierte Dateiinhalte und erlauben den Abgleich mit den `index`-Zeilen beider Diffartefakte:

| Datei | Vorher-Blob aus Originaldiff, rekonstruiert/verifiziert | Nachher-Blob |
|---|---|---|
| [backend/src/lib/prompts/recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | `a940e51b17de37ee5fbf7d7893bb46f422623e94` | `91e13262025d025cb8a691bfd18abe60a9be1e95` |
| [backend/src/lib/prompts/recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | `05039a51fb495973938a16ddf2d288ad3d6ad880` | `73ed39f6b5bbd4fc5f3bf0c7f576e94c27d857b8` |
| [backend/src/lib/openai.ts](../../../backend/src/lib/openai.ts) | `38953615d5ac67118f14cf338ff28d5b591733bf` | `6c0c62050fb813ba3a0d6368c38ddbdab5847cbe` |
| [backend/src/functions/ai.test.ts](../../../backend/src/functions/ai.test.ts) | `403a1f1ef1536dbfe70ffccdaddd0872dc6da20b` | `4537ef6f22cf7ebb4f2a51e1471496a92ca48038` |

Zusaetzliche SHA-256 der UTF-8-Dateiinhalte mit LF-Zeilenenden, ohne BOM (nicht die historischen Dateibytes mit ihren urspruenglichen Zeilenenden):

| Datei | Rekonstruierter Vorhertext, LF-SHA-256 | Nachhertext, LF-SHA-256 |
|---|---|---|
| [backend/src/lib/prompts/recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | `372517A0D132ED778A57B7BE100E83E44F7186F80AEE8CFEF14DE383ECB6B090` | `FD1C8A0553B3DC55C6F8E920032A35F8BF5AF650BFE6B461A04232B07BDE122B` |
| [backend/src/lib/prompts/recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | `112D4539F1D6CF3EA43DA84C676CB96044591180814C4E420F9823A17FC134B6` | `080E47F37B9491F50F682BDC337C921A0E7CFD0CF839ACA6039246A72E8297E0` |
| [backend/src/lib/openai.ts](../../../backend/src/lib/openai.ts) | `F71DE051D724ADA8C7100D786880C48F081FA6EAD9254949702121761F6E2CF6` | `573A0206EB56E2EB609F66CCA1F5FAC955BC6AE8099496FADE133672E966F350` |
| [backend/src/functions/ai.test.ts](../../../backend/src/functions/ai.test.ts) | `3AEC88B8B9A63DE36C0501463128F205361321094F24496E68B1E6544C647108` | `D33FA221BB62D0FEB7A761077EBB60271F911E0C5213917991F997EBEDB4A54A` |

Aktuelle SHA-256 der tatsaechlichen Worktree-Dateibytes bei der Evidenzsicherung:

| Datei | Nachher-Datei-SHA-256 |
|---|---|
| [backend/src/lib/prompts/recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | `4AD5760CF2BBB6CA1E2648A8A0BD256BD5A3C7103B95FBDB9BBF27822EC962A3` |
| [backend/src/lib/prompts/recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | `6A27DBA877F577E67401170B868B660C127AB5B0A9FC1E9ACECE15006F07C656` |
| [backend/src/lib/openai.ts](../../../backend/src/lib/openai.ts) | `AB0C7C0CB650ADF6477B10D2D4128C8B8A164108C9BE2D2C4BD96C75CD0B183D` |
| [backend/src/functions/ai.test.ts](../../../backend/src/functions/ai.test.ts) | `1429068A2C9A43FE2E429F6972B25CBD42F85B05910C4C67DFE87A00D3CC0FEF` |

### Verbleibende Herkunftsgrenzen

Die exakten v14-Ausgangshunks der vier B-1-Dateien sind verfuegbar und repository-backed. Nicht verfuegbar bleibt ein eigenstaendiger lokaler v13-vor-v14-Dateisnapshot, der die vermischten v13/v14-Formulierungen historisch trennt. Weder der gegen v11 basierende Originaldiff noch der aktuelle Endstand ersetzt diesen fehlenden Zwischenstand. Die unten genannten drei ausgesetzten Teilhunks bleiben unveraendert/offen; dieses Evidenzpaket entscheidet ihre Herkunft nicht neu.

Die frueher erfassten Ausgangs-Dateihashes unten sind historische Angaben aus diesem Handoff. Ohne historische Originaldateibytes lassen sich deren Zeilenenden/BOM und damit diese Rohbytehashes nicht unabhaengig rekonstruieren; die LF-Inhalte sind dagegen ueber Originalhunks und Git-Blob-IDs verifiziert. Die bei der jetzigen Sicherung ermittelten Artefakthashes belegen die gesicherten Bytes, keine signierte historische Erfassungszeit.

Externer Pfad zum Verstaendnis oder zur Pruefung benoetigt: **nein**. Die fruehere Sitzungsdatei war nur die Importquelle; alle verwendeten Originalhunks, Endhunks, Herkunftsangaben und Hashes stehen jetzt im Repository. Nicht erfasste historische Status-/Statistikausgaben werden nicht als wiedergewonnene Artefakte behauptet.

Vor dem ersten Edit per Get-FileHash -Algorithm SHA256 erfasste Dateihashes:

| Datei | Ausgangs-SHA-256 |
|---|---|
| [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | 476559E31D445FE5DC4CBA28450B79091D6CE17C20E2958876A025AC05A6378E |
| [recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | DA19DAD899DF90EEA1ED4064AC45DA9DFC927D431A996B34F402961C1B299DA7 |
| [recipeAnalyze.eval.fixtures.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts) | 4D428AE6DA6EEFF1DD9D84C98D3640280FC6043C761613AB59FC6A576347186E |
| [openai.ts](../../../backend/src/lib/openai.ts) | 912A729CFD5A5FAA9FF4164FFCC71380A2E5BC95EFD7ECDECB5D223EF4CB7BE3 |
| [ai.test.ts](../../../backend/src/functions/ai.test.ts) | 54D7E3B6C446895C6EE8BF84D86D45B3EB94A57AD7741D33BF75688CEB00A2DE |

Initial tracked M: backend/src/functions/{ai.test.ts,recipes.test.ts,recipes.ts}; backend/src/lib/{openai.ts,recipeAnalyzeValidation.test.ts,recipeAnalyzeValidation.ts}; backend/src/lib/prompts/{recipeAnalyze.ts,recipeAnalyze.eval.test.ts,recipeAnalyze.eval.fixtures.ts}; docs/kb/domain/{06-recipes.md,07-ai-features.md}; docs/kb/tech/{02-backend.md,06-ai-integrations.md}; docs/qa/findings.md.

Initial untracked: B-2-v14-Handoff; v13-, v14- und v15-Plan in docs/User Stories/Reciepe; v12- und v13-Bericht in docs/qa/reports. Alle erhalten. Dieses Handoff war die einzige neue Datei der urspruenglichen B-1-Ruecknahme; die jetzige Evidenzvervollstaendigung ergaenzt nur die drei im Manifest genannten Diffartefakte.

## Herkunftsabgleich und Hunkmatrix

Quellen: [B-2-v14-Handoff](B-2_Recipe-Analyze-v14_Handoff_2026-10-08.md), insbesondere Changed Files und Live Attempts; [v13-Plan](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md), Abschnitte 1-3; [v14-Plan](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-08-v14.md), nur B-2-Paket; [v13-QA-Bericht](../../qa/reports/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07-v13.md). Historische Testergebnisse dieser Quellen sind keine aktuellen Ergebnisse.

git show da3c45c und b637ee5 sowie git diff da3c45c b637ee5 wurden fuer die geforderten Dateien erfasst. Beide historischen Promptdateien sind v11, nicht v13; ihr Prompt-/openai-Diff ist leer. Sie beweisen die fruehere Temperatur 0.2 und die alte Hoechstens-fuenf-Planungsformulierung, aber nicht den vollstaendigen lokalen v13-Wortlaut. Daher keine komplette Wiederherstellung aus diesen Commits.

| Teilhunk | Entscheidung | Herkunft / konkreter Abgleich |
|---|---|---|
| Promptversion v14; Evalguard v14 | Bewusst v15 | Task Package verlangt v15/Guard; keine Rueckdatierung auf v13 oder v11. |
| exportSuggestion.steps: einleitendes genau min(N,5) statt hoechstens 5 | Ruecknahme nur dieser Einleitung | B-2 nennt Ersatz der konkurrierenden Hoechstens-fuenf-Planung; Historie liefert den alten Wortlaut. Separate exakte Mappingregel bleibt erhalten. |
| Derselbe Absatz: Plane die Gruppen ausschliesslich nach der unten beschriebenen Zuordnung; uebernimm anschliessend ... | Ruecknahme zur frueheren Hoechstens-fuenf-Abschnittsplanung | B-2 Changed Files und Local investigation benennen exakt diese Aenderung. Alte Planung aus beiden historischen Ankern; bestehende Checkliste und Beilagen-/Serviersemantik bleiben. |
| Zuordnung: N=5-Beispiel einschliesslich Garen/Servieren und [5,5] | Ruecknahme | B-2 beschreibt Mehrfachaktionen innerhalb desselben Sourceeintrags als v14-Versuch. Nur dieses zusaetzliche Beispiel entfernt; N=8-Beispiel, exakte Countregel und angrenzende Gruppen bleiben. |
| Gruppenabsatz: zusaetzlicher Export fuer zweite Handlung; mehrere Handlungen gemeinsam; bei Platzmangel kein neuer Eintrag derselben Order | Ruecknahme | Dieselbe ausdrueckliche B-2-Mehrfachaktionskorrektur. Wiederhole oder ueberspringe keine Order sowie Partition und semantische Erhaltung bleiben. |
| analyzeRecipeText temperature 0 | Ruecknahme auf 0.2 | B-2 dokumentiert gescheiterten lokalen Temperaturversuch; Ausgangsdiff enthaelt nur 0.2 -> 0 in diesem Modul. Aktuell kein openai.ts-Diff gegen HEAD. |
| ai.test.ts Requestassertion temperature 0 | Ruecknahme auf 0.2 | B-2 ordnet die Assertion dem lokalen Versuch zu. Assertion selbst, model, max_tokens 2048, Strict Schema und Einmalaufruf bleiben. |
| Nummerierte Sourceanweisungen, zwei getrennte Listen, lueckenlose Sourceorders, Partition, Semantikcheckliste und Beilagen/Servieren | Behalten | V13-Plan, v13-KB und v13-QA belegen diese Semantik; kein fremder Rueckbau. |
| Genau min(N,5), orders 1..M im Mapping und Count-/Order-Eval | Behalten | V13-KB und v14-Paket belegen vorhandene exakte Promptregel. B-2 ergaenzt expliziten Eval. PO-1 bleibt offen, keine Entscheidung fuer maximal 5 statt exakt min(N,5). |
| Vollstaendige Rubrik 1..8, Helper, acht Fixtureinputs und Constraints | Behalten | B-2 Changed Files/Matrix; Datei nach Edit bytegleich zum Ausgangs-SHA-256 oben. Alle Constraints erneut gelesen, keine Aenderung. |
| Verlust-/Swap-/Temperaturproben, exakter Duplikattrace, gueltige angrenzende Gruppierungen und Boundarytests | Behalten | B-2 Offline Evidence; keine Aenderung am Validator-Testfile. Aktueller fokussierter Lauf gruen. |
| Sichere Diagnosen, gespeicherte Sourcevalidierungsbasis, recipes.ts/recipes.test.ts Datenschutzarbeit | Behalten | B-2 bezeichnet diese explizit als vorbestehende B-1-Arbeit. Keine Edits an diesen Dateien. Privacytest erfasst alle Argumente von log/warn/error und prueft auch verschachtelte Argumente auf alle privaten Marker. |
| ai.test.ts Auth-/Quota-/502-/Einmalusage-/Transienztests und voller Importvalidator | Behalten | B-2 Changed Files; nur Temperaturwert geaendert, keine Testentfernung, keine Validatoraenderung. |

## Konkret ausgesetzte Teilhunks

1. Zuordnung, erster Absatz: N ausschliesslich aus Eintraegen statt einzelnen Handlungen und die Formulierungen M/orders 1..M bzw. alle Handlungen in einer gemeinsamen description. B-2 belegt die Absicht, aber vermischt den v14-Versuch mit bereits v13-gueltiger exakter Count-/Mappingsemantik. Kein v13-Dateisnapshot in den geforderten Ankern; nur die eindeutig zusaetzlichen Beispielsaetze entfernt, diese vermischten Saetze erhalten.
2. description je Exportschritt: Wortabbruchverbot, vollstaendiger nichtleerer Satz, alle Komponenten und Fuellwoerter zuerst kuerzen. Im Ausgangsdiff gegen v11 sichtbar, aber im B-2-Handoff nicht als eigener v14-Versuch ausgewiesen. Herkunft v12/v13/v14 nicht sicher abgrenzbar; unveraendert.
3. Letzte JSON-Pruefregel: exakte Count-/Orderregel, vollstaendiger Satz und Details nur in zugeordneten Gruppen. Kein belegter v13-Wortlaut fuer diesen gemischten Hunk. Unveraendert, insbesondere keine Abschwaechung der Countregel.

Nur diese Teilhunks sind ausgesetzt; die belegbaren Ruecknahmen wurden trotzdem ausgefuehrt. Fuer ihre Disposition wird konkrete v13-vor-v14-Hunkevidenz benoetigt, nicht eine pauschale Wiederherstellung aus v11.

## Aktuelle Gates

Alle Befehle vom Workspace-Root; Ergebnisse ausschliesslich aus der urspruenglichen B-1-Codebearbeitung am 2026-10-09. Bei der jetzigen Handoff-Vervollstaendigung wurden diese Gates nicht wiederholt; sie werden nicht als neue Ergebnisse ausgegeben.

| Befehl | Exitcode | Aktueller Befund |
|---|---:|---|
| npm test --workspace=backend -- src/lib/recipeAnalyzeValidation.test.ts src/functions/ai.test.ts src/functions/recipes.test.ts --reporter=dot --silent | 0 | 265/265, 3 Dateien; erster Schritt unmittelbar nach Codeedit, Start 09:21:55. |
| npm exec --workspace=backend -- vitest run --config vitest.eval.config.mts src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "^prompt version matches fixture expectations$" --reporter=verbose | 0 | Nur Guard 1/1; acht Live-Fixtures bewusst abgewahlt/skipped. Kein Provider- oder Preparation-Livenachweis. |
| npm test --workspace=backend -- --reporter=dot --silent | 0 | 1378/1378, 66 Dateien; 24.08 Sekunden. |
| npm run typecheck --workspace=backend | 0 | Keine TypeScript-Diagnosen. |
| npm run build:verify --workspace=backend | 0 | Build, Modulauflosung, doppelte Function-IDs gruen; erwartete Azure-Functions-Testmoduswarnungen. |
| git diff --check | 0 | Keine Whitespacefehler; bestehende CRLF/LF-Warnungen. |

Editor-Diagnostik fuer alle vier geaenderten Backenddateien: keine Fehler. Fixture-SHA-256 nach Edit unveraendert. Kein neuer Red/Green-Bugfix behauptet; bestehende Regressionen pruefen die Ruecknahme, nicht universelle Promptstabilitaet.

## Invarianten und Grenzen

Fokussierte Tests bleiben gruen fuer Auth vor weiterer Arbeit, optionales ETag vor Quota/Provider, 422/429/502, Strict Schema, einen Providercall, genau einmal Usage nur nach validem Erfolg, Text-only V2, Transienz, Sourcevalidierung gegen gespeicherte Schritte und vollstaendige Analyze-/Zutatenvalidierung beim Import. Die erhaltene Datenschutzregression schliesst private Rezept-, Modell- und Validierungsfehlertexte in allen erfassten log/warn/error-Argumenten aus; dies ist keine pauschale Aussage ueber jedes denkbare Log in der gesamten Anwendung.

Preparation-Live, drei vorab festgelegte unmittelbar aufeinanderfolgende volle Laeufe und Gesamt-Liveeval: UNVERIFIED / in diesem Paket nicht ausgefuehrt. Credentials wurden nicht gelesen oder auf Verfuegbarkeit geprueft; kein fehlender Credentialstatus behauptet. Kein zufaelliger oder historischer PASS als aktueller Nachweis verwendet. Neues Livegate ausschliesslich B-2.

KB-Abweichung: [AI-Features](../../kb/domain/07-ai-features.md) und [AI-Integrationen](../../kb/tech/06-ai-integrations.md) nennen weiterhin v13 und die alte reduzierte Semantikpruefdeckung, waehrend Code/Guard jetzt v15 und die erhaltene Rubrik 1..8 sind. Keine KB-Edits, weil das Task Package spaetere Pakete ausschliesst; gezielte Angleichung ist separat zu uebergeben. Historische Plaene/QA/Findings unveraendert.

Scopeabweichungen: keine erweiterten Implementierungen. Vollsuite/Typecheck/Build sind Verifikation dieses Edits, kein spaeteres Implementierungspaket. Vier Backenddateien manuell geaendert plus dieses Handoff; kein shared/mobile/infra-, Handler-, Schema-, API-, Repository-, Modell- oder Tokenbudgetedit. Ausgesetzte Teilhunks verhindern die Behauptung einer vollstaendigen Ruecknahme aller v14-Formulierungen.