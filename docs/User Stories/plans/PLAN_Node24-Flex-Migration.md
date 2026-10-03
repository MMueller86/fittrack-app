# Technischer Migrationsplan: Node 24 LTS und Azure Functions Flex Consumption

**Status:** Revidierte Planversion nach dem `WP-IR01`-STOP vom 2026-09-29 und der finalen WA-15-Gate-Klarstellung; wartet ausschließlich auf die neue WA-15-Identity-/Scope-Evidence einschließlich der Prüfung auf erforderliche Role-Assignment-Fähigkeit und danach neue explizite `APPROVE`; diese Planversion implementiert, testet oder deployt nichts.
**Planrevision:** `2026-09-29-WP-IR01-STOP-04`.
**Plan-Typ:** Large Change / Infrastruktur- und Runtime-Migration
**Original Requirement:** Migration auf Node 24 LTS mit Azure Functions Flex Consumption.
**Stand der Planung:** 2026-09-29
**Infrastructure Impact:** Alpha
**Mobile Build Impact:** None

**Approval Lifecycle:** Die frühere `APPROVE`-Freigabe gilt ausschließlich für die vorherige Planversion und ist durch diese Revision ungültig. Vor einer neuen `APPROVE` muss nur die externe WA-15-Evidence vorliegen: die tatsächliche dedizierte Deployment-Identität, ihr `Contributor`-Scope ausschließlich auf der bestehenden Resource Group `rg-Michael-Mueller` und eine read-only Prüfung, ob die geplante Migration/IaC neue RBAC Role Assignments erstellt. Wenn keine Role Assignments erstellt werden, ist die RG-scoped-`Contributor`-Rolle die zulässige Basis. Wenn Role Assignments erstellt werden, müssen die exakt erforderlichen Berechtigungen an den jeweils erforderlichen engsten Assignment-Scopes sowie eine Assignment-Allowlist evidenceiert sein; Subscription-`Contributor`, `Owner` und breite Eskalationen sind verboten. Kann die erforderliche Assignment-Berechtigung oder ihr Scope read-only nicht bestätigt werden, ist `UNVERIFIED-PERMISSIONS`/`STOP` zu liefern und keine Annahme zu treffen. Subscription-spezifische Quota-Evidence und `Storage Blob Data Reader`-Evidence sind keine Vorbedingungen für diese Freigabe, für WP-IR01 oder für WP-B01. EAS-Berechtigung wird erst im späteren EAS-WP geprüft und ist kein Pre-Approval-Blocker. Danach muss der Benutzer für genau diese gespeicherte Planrevision `2026-09-29-WP-IR01-STOP-04` eine neue ausdrückliche `APPROVE` erteilen. Erst dann darf der Orchestrator ausschließlich das erneut read-only auszuführende WP-IR01 starten. Kein Implementierungs-, IaC-, Deployment-, EAS- oder QA-WP darf vor einem vollständigen WP-IR01-`PASS` unter diesen revidierten Semantiken starten. Ein solcher `PASS` darf `UNVERIFIED-QUOTA` als nicht blockierende Mess-Evidence und den historischen `UNVERIFIED-BLOB-DATA-READER` als nicht erforderliche Data-Plane-Evidence dokumentieren. Die Quota-Kontrolle nach DEV-/Alpha-Provisionierung bleibt ein harter Stop bei unzureichender Unterstützung oder widersprochener Standard-Quota-Basis. Das Statusfeld ist nur Dokumentation; die aktuelle Freigabe im Workflow ist maßgeblich. Jede Planrevision nach einem Annahmenfehler invalidiert die vorherige Freigabe und benötigt erneut `APPROVE`.

**Final clarification recorded for this revision:**
- `Contributor` scoped exclusively to `rg-Michael-Mueller` is sufficient as the dedicated deployment identity basis only when the migration/IaC does not need to create new RBAC Role Assignments.
- If Flex host storage, Managed Identity, or another part of the IaC requires new Role Assignments, add only the specifically required permission(s) at the narrowest necessary scope. Do not restore subscription-wide Contributor/Owner access or broad escalation.
- The intended sequence remains: RG-scoped identity + scope evidence -> fresh explicit `APPROVE` -> read-only WP-IR01 -> regular sequence.
- Do not promote quota or Blob Reader back to blocking gates. Keep quota as post-provisioning operational validation and keep Blob inventory/data-plane reader evidence unnecessary, while preserving the hard protection against any Business Storage/blob mutation, migration, replacement, move, or delete.

**Normative WA-15 pre-approval semantics:**
1. Required pre-approval evidence is the actual dedicated deployment identity, its RG-only scope, and a review of whether planned IaC creates any Role Assignments.
2. If no Role Assignments are created, RG-scoped `Contributor` is accepted as the basis.
3. If Role Assignments are created, the plan requires targeted permission to create exactly those assignments, at their required scope, and documents the assignment allowlist; subscription-wide `Contributor`/`Owner` is forbidden.
4. If the needed assignment permission/scope cannot be confirmed read-only, the result is explicit `UNVERIFIED-PERMISSIONS`/`STOP`, not an assumption.
5. Azure RBAC self-repair by the executor is not an allowed workaround.

## Open Product Owner Decisions

Keine. `Always Ready = 0`, `Maximum Instances = 5`, Node 24, Flex Consumption und die unveränderten Daten-/Storage-Invarianten sind vorgegebene Zielbedingungen. Technische Nichtbestätigung ist keine Produktentscheidung: Sie löst das untenstehende Plan-Assumption-Failure-Protokoll und eine Planrevision aus. Kein Agent darf daraus einen Ersatzwert, eine alternative Architektur oder einen stillen Abbruch ableiten.

## Working Assumptions and Validation

Die folgende Tabelle ist verbindlich. Eine Arbeitsannahme ist weder ein bestätigter Ist-Fakt noch eine Freigabe zur Mutation. Der angegebene Agent prüft sie im genannten Work Package. Tatsächliche Abweichungen werden mit dem exakten Fehlercode gemeldet; fehlende Evidence für einen blockierenden Vertrag führt zu `UNVERIFIED` und ist kein erfolgreicher Handoff. Für Quota und Blob-Data-Plane gilt die unten ausdrücklich dokumentierte, nicht blockierende beziehungsweise nicht erforderliche Evidence-Semantik.

| ID | Arbeitsannahme | Begründung | Prüfender Agent / WP | Prüfzeitpunkt | Zulässige Evidence | Fehlercode bei Abweichung |
|---|---|---|---|---|---|---|
| WA-01 | Ziel bleibt die bestehende Resource Group `rg-Michael-Mueller` in `northeurope`. | Vorherige read-only Azure-Evidence und KB verlangen eine gemeinsame bestehende Resource Group. | Infrastructure / WP-IR01, erneut vor WP-IR03 und WP-IR05 | Vor jeder Azure-Mutation | `az account show`, `az group show`, ARM-GET mit Subscription, Resource Group, Region und Status | `PLAN-ASSUMPTION-INVALID:WA-01` |
| WA-02 | Flex Consumption FC1, Linux, Node 24 LTS und Functions Runtime v4 sind im Ziel-Resource-/API-Scope verfügbar. | Diese Kombination wurde für `northeurope` beobachtet; bestehende Y1-Apps bleiben unverändert. | Infrastructure / WP-IR01 | Read-only vor jeder IaC-Änderung | Aktuelle Microsoft.Web-Regional-/Runtime-Abfrage, Provider-Schema und dokumentierter Flex-Vertrag | `PLAN-ASSUMPTION-INVALID:WA-02` |
| WA-03 | Der bestätigte ARM-Scope ist `Microsoft.Web/serverFarms@2024-04-01` plus `Microsoft.Web/sites@2024-04-01`; die Scale-Eigenschaften liegen unter `properties.functionAppConfig.scaleAndConcurrency`. | Der Quickstart bestätigt die Zuordnung, die Provider-/Dienstsemantik muss getrennt belegt werden. | Infrastructure / WP-IR01 | Vor WP-IR02 | Versioniertes ARM-Schema, Microsoft-Dokumentation und unterstützte read-only Schema-/What-if-Prüfung | `PLAN-ASSUMPTION-INVALID:WA-03` |
| WA-04 | `Maximum Instances = 5` ist der unveränderte Nutzer-Zielwert für das Flex-Instance-Limit im exakt verifizierten Scope. | WP-IR01 vom 2026-09-29 bestätigt `5` im Flex-Instance-Scope; der Quickstart-Decorator `@minValue(40)` bleibt ausschließlich eine Template-Input-Constraint und kein Ersatzwert. | Infrastructure / WP-IR01, Post-Checks WP-IR03/WP-IR05 | Vor WP-IR02 und nach jeder Provisionierung | Scope-/Schema-Matrix mit Template-Constraint, Provider-/Dienstregel, erfolgreicher What-if-Validierung mit `5` und GET-Evidence | `PLAN-ASSUMPTION-INVALID:WA-04` bzw. `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED` bei späterer Abweichung |
| WA-05 | `Always Ready = 0` wird explizit im vorgesehenen Flex-Property-Scope abgebildet und nach Provisionierung gelesen. | WP-IR01 vom 2026-09-29 bestätigt die explizite `http: { instanceCount: 0 }`-Darstellung; der dokumentierte Default wird nicht als Beweisersatz verwendet. | Infrastructure / WP-IR01, WP-IR03, WP-IR05 | Explizit vor WP-IR02 und per GET danach | API-/Property-Evidence für `alwaysReady[]`, erfolgreiche What-if-Validierung mit Wert `0` und Post-GET | `PLAN-ASSUMPTION-INVALID:WA-05` bzw. `STOP-AR0-UNSUPPORTED` bei späterer Abweichung |
| WA-06 | Die dokumentierte Standard-Flex-Quota gilt als ausreichende Arbeitsbasis für den geplanten kleinen DEV-/Alpha-Workload. Eine subscription-spezifische Messung ist im Preflight nicht erforderlich und darf nicht durch erfundene Werte ersetzt werden. | Die bisherige Abfrage lieferte keine Flex-Memory-Metrik; der dokumentierte Standard-Quota-Vertrag ist für diese kleine Zielauslastung die operative Basis. Die tatsächliche Unterstützung wird nach DEV- und Alpha-Provisionierung kontrolliert. | Infrastructure / WP-IR01, WP-IR03, WP-IR05, WP-IR10 | Arbeitsbasis in WP-IR01; harte Kontrolle nach jeder Provisionierung und im Release-Nachweis | WP-IR01 dokumentiert Quelle und Geltungsbereich der Standard-Quota-Basis, ohne einen aktuellen subscription-spezifischen Wert zu behaupten. WP-IR03/WP-IR05 evidenceieren Workload-Unterstützung, Quelle und Zeitpunkt; eine verfügbare Messung wird unverändert mit Einheit und Scope übernommen. Keine Provider-Registrierung und keine Quota-Erhöhung nur für Evidence. | Bei tatsächlicher Unterversorgung `PLAN-ASSUMPTION-INVALID:WA-06` plus `STOP-FLEX-QUOTA-INSUFFICIENT`; bei widersprochener Standardbasis `PLAN-ASSUMPTION-INVALID:WA-06` plus `STOP-FLEX-QUOTA-BASIS-CONTRADICTED`; fehlende Preflight-Messung bleibt nicht blockierendes `UNVERIFIED-QUOTA` |
| WA-07 | DEV und Alpha behalten ihre bestehenden Business-Storage-Accounts, Cosmos-Ressourcen, Queue `reusable-items-enrich`, Blob-Container und Blob-Daten; `STORAGE_CONNECTION_STRING` ist der Business-Storage-Vertrag. | Diese Trennung ist Nutzeranforderung, KB-/Repository-Vertrag und Sicherheitsinvariante. | Backend / WP-B01; Infrastructure / WP-IR01 bis WP-IR10 | Vor Code-/IaC-Änderung und in jedem Azure-Post-Check | Resource-IDs, Setting-Matrix, Queue-/Container-GETs, What-if-Allowlist und explizite No-Mutation-Evidence; keine Blob-Dateninventur, Schreib-/Move-Operation oder Migration | `PLAN-ASSUMPTION-INVALID:WA-07` |
| WA-08 | Für diese Migration ist keine Blob-Data-Plane-Inventur, kein Digest und keine `Storage Blob Data Reader`-Evidence erforderlich. Bestehendes Business Storage wird ausschließlich über Control-Plane-Resource-Referenzen, Settings, Queue-/Container-GETs, What-if-Allowlists und No-Mutation-Evidence geschützt. | Control-Plane- und What-if-Evidence steuern die erlaubte Ressourcenkomposition; Blob-Daten-Listing ist keine Voraussetzung und darf nicht als Beweis für vorhandene oder fehlende Daten interpretiert werden. | Infrastructure / WP-IR01, WP-IR03, WP-IR05, WP-IR09 | Read-only vor jedem What-if/Deploy und in jedem Azure-Post-Check | Bestehende Business-Storage-Resource-IDs, Settings, Queue-/Container-Referenzen, What-if-Allowlist und Nachweis ohne Business-Storage-/Blob-Mutation; keine Data-Plane-Liste erforderlich | Tatsächliche Business-Storage-/Blob-Mutation oder Migration: `PLAN-ASSUMPTION-INVALID:WA-08` plus `STOP-BUSINESS-STORAGE-MUTATION`; fehlender Blob-Reader ist kein Fehlercode und kein Blocker. Der historische Befund `UNVERIFIED-BLOB-DATA-READER` bleibt reine Ausführungs-Evidence. |
| WA-09 | Eventuell erforderliches Flex Host-/Deployment-Storage ist je Environment plattformtechnisch getrennt und ersetzt niemals Business Storage. Das konkret vom verifizierten Flex-Vertrag verlangte Modell wird in derselben IaC-Komposition umgesetzt. | Flex kann Host-/Deployment-Storage separat verlangen; zukünftige Resource-IDs existieren beim Preflight noch nicht. | Infrastructure / WP-IR01 und WP-IR02 | Modell read-only in WP-IR01, IaC vor WP-IR03 | Provider-/Schema-Evidence, Resource-Modell, Naming, What-if-Allowlist und Setting-Matrix | `PLAN-ASSUMPTION-INVALID:WA-09` bzw. `STOP-HOST-STORAGE-MODEL` |
| WA-10 | Jede Flex-App erhält eine eigene Application-Insights-Zuordnung, getrennt von der Legacy-Y1-Telemetrie; DEV und Alpha werden nicht über die Legacy-Connection beobachtet. | Nutzeranforderung schützt die bestehende Telemetrie und verlangt getrennte Flex-Evidence. | Infrastructure / WP-IR01, WP-IR02, WP-IR03, WP-IR05 | Contract vor WP-IR02; Resource-/Setting-GET nach Provisionierung | Resource-IDs, Connection-String-Zuordnung ohne Secretwerte, What-if und Query-/Smoke-Evidence | `PLAN-ASSUMPTION-INVALID:WA-10` |
| WA-11 | Azure OpenAI, Document Intelligence und CIAM bleiben die bestehenden shared Dienste; zusätzliche Instanzen und neue Auth-/API-Verträge sind nicht Teil der Migration. | Architekturentscheidung der KB und Nutzeranforderung. | Infrastructure / WP-IR01 bis WP-IR05; Backend / WP-B01 | Vor IaC und in Post-Checks | Bestehende Endpoint-/Resource-Referenzen, Setting-Matrix und Auth-Smoke ohne Secretwerte | `PLAN-ASSUMPTION-INVALID:WA-11` |
| WA-12 | Der Windows-zu-Linux-Release erfolgt aus `_deploy_staging/` mit Remote-Oryx `--build remote --javascript`; `sharp` und `@resvg/resvg-js` werden Linux-x64-seitig gebaut. | KB und bestehender Releaseprozess schreiben diesen Weg vor. | Infrastructure / WP-IR01, WP-IR02, WP-IR04, WP-IR06 | Weg vor WP-IR02; Artefakt vor Deploy | `func`-/Azure-Dokumentation, staging manifest/lockfile, Build-Manifest und Linux-Native-Smoke | `PLAN-ASSUMPTION-INVALID:WA-12` |
| WA-13 | Bestehende Y1-Apps bleiben bis zum bestandenen Alpha-Smoke unverändert; danach wird ausschließlich der erlaubte Y1-Hosting-Scope decommissioniert. | Rollout- und Recovery-Schutz der Nutzeranforderung. | Infrastructure / WP-IR03 bis WP-IR10 | Schutz-What-if vor jedem Deploy/Decommission | Resource-ID-Allowlist, What-if, Pre-/Post-GETs und Recovery-Referenzen | `PLAN-ASSUMPTION-INVALID:WA-13` |
| WA-14 | `mobile/eas.json` erhält genau ein `preview-flex`-Profil mit direkter Alpha-Flex-URL einschließlich `/api`; ein neuer installierbarer EAS-Build ist vor dem Alpha-Smoke zwingend. | `EXPO_PUBLIC_API_URL` wird build-time eingebettet; der vorhandene `preview` zeigt auf Y1. | Frontend / WP-M01; Infrastructure / WP-IR07 | Profil nach Alpha-Hostname, Build vor WP-IR08 | Statischer Diff, Build-ID, installierbares Artefakt und eingebettete URL; keine Native-/Secret-Änderung | `PLAN-ASSUMPTION-INVALID:WA-14` |
| WA-15 | Für jede Phase wird eine eigene, nur für diese Phase verwendete Azure-/EAS-Identität eingesetzt. Vor einer neuen `APPROVE` müssen die tatsächliche dedizierte Azure-Deployment-Identität, ihr `Contributor`-Scope ausschließlich auf der bestehenden Resource Group `rg-Michael-Mueller` und eine read-only Prüfung vorliegen, ob die geplante Migration/IaC neue RBAC Role Assignments erstellt. Erst wenn keine Role Assignments erstellt werden, ist RG-scoped `Contributor` die ausreichende Berechtigungsbasis. Wenn Flex Host Storage, Managed Identity oder ein anderer IaC-Teil Role Assignments erstellt, werden nur die exakt erforderlichen Berechtigungen an den engsten erforderlichen Assignment-Scopes zugelassen und per Assignment-Allowlist dokumentiert. Subscription-scoped `Contributor`, `Owner` und breite Eskalationen sind unzulässig. | Least privilege ist Sicherheitsvorgabe. Die am 2026-09-29 verwendete `Contributor`-Identität auf Subscription-Scope verletzt auch unter der revidierten Policy den Scope-Vertrag und darf nicht erneut verwendet werden. Eine RG-scoped `Contributor`-Identität erfüllt WA-15 nur bei nachgewiesenem No-Role-Assignment-Fall; andernfalls muss die read-only bestätigte targeted Assignment-Fähigkeit vorliegen. | Infrastructure / WP-IR01 und jedes mutierende IR-WP; Auflösung durch Subscription-/Cloud-Owner vor der nächsten Ausführung | Vor dem erneuten WP-IR01 und vor jedem weiteren Schritt | Pre-Approval: tatsächliche Identität, effektiver RG-only-Scope und Assignment-Review. Bei keinem Assignment: explizite No-Assignment-Evidence. Bei Assignments: exakte Permission(s), erforderliche Scopes, Principal-/Role-/Scope-Allowlist und read-only bestätigte Fähigkeit, genau diese Assignments zu erstellen. EAS-Berechtigungsnachweis ohne Tokens erst im EAS-WP; keine Owner-/Subscription-Contributor-Rechte und keine RBAC-Selbstreparatur durch den Executor | `PLAN-ASSUMPTION-INVALID:WA-15` bei Subscription-`Contributor`, Owner, falschem Scope, nicht phasenbezogener Nutzung, nicht allowlist-konformer Assignment-Fähigkeit oder breiter Eskalation; `UNVERIFIED-PERMISSIONS` plus `STOP` bei nicht read-only bestätigbarer Permission oder Scope |

**Aktueller Gate-Status nach dem ausgeführten WP-IR01 vom 2026-09-29:**

| Gate | Aktueller Status | Verbindliche Auflösung vor dem erneuten WP-IR01 |
|---|---|---|
| `WA-04` / `Maximum Instances = 5` | `SUPPORTED` | `5` unverändert beibehalten; WP-IR01 erneut nur auf aktuellen Drift prüfen, WP-IR03/WP-IR05 lesen den tatsächlichen Post-GET im selben Flex-Instance-Scope. |
| `WA-05` / `Always Ready = 0` | `SUPPORTED` | Explizite Darstellung mit `instanceCount: 0` unverändert beibehalten; WP-IR03/WP-IR05 lesen den tatsächlichen Post-GET. |
| `WA-06` / Flex-Memory-Quota | Dokumentierte Standard-Quota-Basis; historisches `UNVERIFIED-QUOTA` ist nicht blockierend | Keine externe Quota-Auflösung vor WP-IR01 oder WP-B01 erforderlich. WP-IR01 dokumentiert die Standardbasis, ohne einen präzisen aktuellen Subscription-Wert zu behaupten. WP-IR03 und WP-IR05 kontrollieren nach Provisionierung die tatsächliche Workload-Unterstützung; Unterversorgung oder widersprochene Basis erzeugt den präzisen WA-06-STOP-Code. Keine Provider-Registrierung und keine Quota-Erhöhung. |
| `WA-08` / Blob-Daten-Leser | Kein Preflight-Data-Plane-Gate; historisches `UNVERIFIED-BLOB-DATA-READER` ist nicht blockierend | Keine Storage-Owner-Auflösung, Blob-Inventur oder Data-Reader-Evidence erforderlich. Control-Plane-Resource-Referenzen, Setting-/Resource-Matrix, What-if-Allowlist und No-Mutation-Evidence bleiben verbindlich. Tatsächliche Business-Storage-/Blob-Mutation oder Migration ist ein harter STOP. |
| `WA-15` / Least-Privilege-Identität | `PLAN-ASSUMPTION-INVALID:WA-15` und `STOP` | Subscription-/Cloud-Owner ersetzt die verwendete Subscription-`Contributor`-Identität durch eine dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller` und liefert die Rollen-/Scope-Matrix einschließlich der read-only Prüfung, ob geplante IaC Role Assignments erstellt. Ohne Role Assignments ist RG-scoped `Contributor` die Basis; mit Role Assignments werden nur die exakt erforderlichen Permissions an den erforderlichen Scopes und eine Assignment-Allowlist evidenceiert. Der aktuelle Subscription-Contributor darf nicht erneut verwendet werden; Owner, breite Eskalation oder RBAC-Selbstreparatur durch den Executor sind keine Auflösung. |

Der historische Gesamtstatus dieses Handoffs bleibt `Result: STOP`, `Mutation: NO`; `WP-B01` und alle Folge-WPs durften aus diesem Lauf nicht direkt starten. Die beiden `SUPPORTED`-Befunde für `5` und `0` werden nicht zu offenen Fragen zurückgestuft. Unter der revidierten Policy ist nur `WA-15` ein noch zu schließender Pre-Approval-Blocker. `UNVERIFIED-QUOTA` ist eine nicht blockierende Preflight-Mess-Evidence und `UNVERIFIED-BLOB-DATA-READER` ist eine historische, nicht erforderliche Data-Plane-Evidence. Nach WA-15-Evidence und neuer `APPROVE` muss WP-IR01 trotzdem frisch read-only ausgeführt werden; erst dessen vollständiger `PASS` entsperrt WP-B01. Die Quota-Kontrolle nach DEV-/Alpha-Provisionierung bleibt ein harter Stop bei tatsächlicher Unterversorgung oder widersprochener Standardbasis.

## Plan Assumption Failure Protocol

1. Der zuständige Agent prüft alle für sein Work Package relevanten `WA-*`-IDs vor jeder gefährlichen oder irreversiblen Mutation. Er vergleicht die Ist-Werte mit der Annahme und führt keine Mutation aus, solange die für diese Phase blockierenden Prüfungen nicht `PASS` ergeben.
2. Bei einer tatsächlichen Abweichung stoppt der Agent sofort und liefert `Result: STOP` mit `PLAN-ASSUMPTION-INVALID:<ID>` oder dem präziseren technischen Code aus der Tabelle. Bei fehlender oder nicht lesbarer Evidence für einen blockierenden Vertrag liefert er `Result: UNVERIFIED` mit dem passenden `UNVERIFIED-*`-Code. `UNVERIFIED-QUOTA` darf im Preflight als nicht blockierende Mess-Evidence dokumentiert werden; `UNVERIFIED-BLOB-DATA-READER` bleibt ausschließlich historischer, nicht erforderlicher Data-Plane-Befund. Diese beiden Statuswerte entsperren oder blockieren allein kein Folge-WP.
3. Der Handoff enthält secretfrei: Planpfad und Planversion, WP-ID, Annahmen-ID, erwarteten Wert, tatsächlichen Wert, konkrete Evidence-Quelle und Zeitpunkt, bereits ausgeführte Mutation (`NO` muss vor dem Gate stehen), `PASS`/`STOP`/`UNVERIFIED` sowie die blockierten Folge-WPs. Connection Strings, Tokens, Keys und personenbezogene Testdaten werden nicht ausgegeben.
4. Der Agent wählt keinen Ersatzwert, registriert keinen Provider nur für den Nachweis, erhöht keine Quota, verwendet keinen Default als Beweis und ändert insbesondere `Maximum Instances = 5` niemals still auf `40`. Eine technische Abweichung wird nicht als eigene Architekturentscheidung behandelt.
5. Der Orchestrator ruft den Planner mit der vollständigen aktuellen Planversion, dem Agent-Handoff und dem Fehlercode erneut auf. Die bestätigte Abweichung `PLAN-ASSUMPTION-INVALID:WA-15` invalidiert die frühere Freigabe; diese Revision bleibt bis zur WA-15-Evidence und einer neuen ausdrücklichen `APPROVE` gesperrt. Eine Fortsetzung beginnt danach ausschließlich mit einem erneuten read-only WP-IR01. Bis zu dessen vollständigem `PASS` bleiben alle Mutationen gestoppt.
6. Für die aktuelle `WA-15`-Abweichung ist der Subscription-/Cloud-Owner verantwortlich. Er muss die verwendete Subscription-`Contributor`-Identität aus dem Ausführungspfad entfernen, eine dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller` bereitstellen und vor der neuen Freigabe die tatsächliche Identität, den RG-only-Scope sowie die read-only Prüfung vorlegen, ob die geplante IaC Role Assignments erstellt. Wenn keine Role Assignments erstellt werden, ist diese RG-scoped-`Contributor`-Basis ausreichend. Wenn Flex Host Storage, Managed Identity oder ein anderer IaC-Teil Role Assignments erstellt, müssen die exakt erforderlichen Permission(s), die engsten erforderlichen Assignment-Scopes und die Assignment-Allowlist evidenceiert werden; `Microsoft.Authorization/roleAssignments/write` oder ein engeres Äquivalent darf nur für diese konkreten Assignments gelten. Kann Permission oder Scope nicht read-only bestätigt werden, lautet das Ergebnis `UNVERIFIED-PERMISSIONS`/`STOP` statt einer Annahme. EAS-Berechtigung wird erst im EAS-WP evidenceiert. Der Executor darf keine Owner-/Subscription-Contributor-Eskalation oder eigene Azure-RBAC-Reparatur als Ersatz ausführen.
7. Für `UNVERIFIED-QUOTA` ist vor dem erneuten WP-IR01 keine Owner-Auflösung erforderlich. WP-IR01 dokumentiert die dokumentierte Standard-Flex-Quota als Arbeitsbasis für den kleinen DEV-/Alpha-Workload, behauptet keinen präzisen aktuellen Subscription-Wert und führt keine Provider-Registrierung oder Quota-Erhöhung nur für Evidence aus. WP-IR03 und WP-IR05 müssen die tatsächliche Workload-Unterstützung nach Provisionierung mit Quelle und Zeitpunkt evidenceieren. Unterversorgung führt zu `PLAN-ASSUMPTION-INVALID:WA-06` plus `STOP-FLEX-QUOTA-INSUFFICIENT`; eine widersprochene Standardbasis zu `PLAN-ASSUMPTION-INVALID:WA-06` plus `STOP-FLEX-QUOTA-BASIS-CONTRADICTED`.
8. Für `UNVERIFIED-BLOB-DATA-READER` ist keine Owner-Auflösung erforderlich. Eine Blob-Inventur oder ein Digest wird nicht verlangt. WP-IR01 und alle mutierenden WPs müssen stattdessen Control-Plane-Resource-Referenzen, Settings, What-if-Allowlist und No-Mutation-Evidence prüfen. Eine tatsächliche Business-Storage-/Blob-Mutation oder Migration führt zu `PLAN-ASSUMPTION-INVALID:WA-08` plus `STOP-BUSINESS-STORAGE-MUTATION`; fehlender Data-Reader beweist weder Datenabwesenheit noch Datenmigration.
9. Sobald die WA-15-Evidence vollständig und secretfrei vorliegt, erteilt der Benutzer für diese gespeicherte Planrevision eine neue explizite `APPROVE`. Diese Freigabe autorisiert nur WP-IR01 read-only. WP-IR01 darf ohne subscription-spezifische Quota-Messung und ohne Blob-Data-Reader-Evidence laufen. Ein vollständiger `PASS` unter diesen revidierten Semantiken entsperrt WP-B01; ein `STOP` oder ein blockierendes `UNVERIFIED`, insbesondere `UNVERIFIED-PERMISSIONS`/`STOP` bei nicht bestätigbarer Role-Assignment-Fähigkeit, führt wieder hierher und entsperrt kein Implementierungs-WP.

## 1. Requirement Assessment

**Klassifikation:** Accept with modifications; die Flex-Migrationsausführung folgt einem einzigen Zielpfad. `Maximum Instances = 5` und `Always Ready = 0` sind durch das read-only WP-IR01 vom 2026-09-29 im exakten Flex-Scope als `SUPPORTED` bestätigt und bleiben unverändert die Zielwerte. Die späteren Post-Provisioning-GETs prüfen nur, dass diese bestätigten Werte nicht abweichen. Eine technische Abweichung beendet die Ausführung über das Plan-Assumption-Failure-Protokoll.

**Bewertung von WA-15:** `WA-15` bleibt ein echter Planannahmenfehler. Das Handoff belegt, dass die ausführende Identität `Contributor` auf Subscription-Scope war; dieser Scope ist auch unter der revidierten Policy unzulässig. Zulässig ist eine dedizierte, phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller`, sofern die read-only Prüfung keine neuen Role Assignments in der geplanten Migration/IaC ergibt. Falls Flex Host Storage, Managed Identity oder ein anderer IaC-Teil Role Assignments erstellt, müssen vor der Freigabe die exakt erforderlichen targeted Permission(s), Assignment-Scopes und die Allowlist read-only bestätigt werden. Owner-Rechte, Subscription-scoped `Contributor` und breite Eskalationen bleiben ausgeschlossen. Die aktuelle Identität darf nicht erneut verwendet werden; die Auflösung liegt beim Subscription-/Cloud-Owner und muss vor dem erneuten WP-IR01 secretfrei evidenceiert werden.

**Plan-Revision wegen des aktuellen WP-IR01-Handoffs:** Der historische Gesamt-STOP enthält `PLAN-ASSUMPTION-INVALID:WA-15`, `UNVERIFIED-QUOTA` und `UNVERIFIED-BLOB-DATA-READER`. Diese Revision wählt keinen Ersatzwert, keine Ersatzberechtigung und keine alternative Architektur. Nur `WA-15` bleibt ein externer Blocker vor der neuen Freigabe: Der Subscription-/Cloud-Owner stellt die dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller` bereit und evidenceiert read-only, ob die geplante IaC neue Role Assignments erstellt. Bei keinem Assignment genügt diese RG-scoped-`Contributor`-Basis; bei Assignments müssen die exakt erforderlichen targeted Permission(s), Scopes und Assignment-Allowlist vorliegen. Die historischen Quota- und Blob-Codes werden nicht als offene Preflight-Gates fortgeführt. Nach dieser Evidence und einer neuen expliziten `APPROVE` wird WP-IR01 erneut ausschließlich read-only ausgeführt. Kein Implementierungs-WP darf auf Basis des alten Handoffs direkt starten.

Die aktuelle Scope-Evidence für `Maximum Instances = 5` ist abgeschlossen: `Microsoft.Web/sites@2024-04-01`, `properties.functionAppConfig.scaleAndConcurrency.maximumInstanceCount`, ARM-Typ `int`, der Microsoft-Quickstart mit `@minValue(40)` als Template-Input-Guard und ein erfolgreicher read-only What-if mit `5` bestätigen den Wert im Flex-Instance-Scope. Der Quickstart-Decorator wird nicht als serverseitige Mindestgrenze gelesen, aber die aktuelle Evidence ist nun ausreichend für `SUPPORTED`; `40` bleibt verboten. Die aktuelle Scope-Evidence für `Always Ready = 0` ist ebenfalls abgeschlossen: `properties.functionAppConfig.scaleAndConcurrency.alwaysReady[]` mit explizitem What-if `http: { instanceCount: 0 }` ist `SUPPORTED`; der spätere GET bleibt Pflicht.

Die bestehende Linux-Consumption/Y1-App ist im Repository auf Node 22 modelliert; der gemeldete Azure-Ist-Zustand zeigt DEV-Node-20- und Alpha-Node-22-Drift. Node 24 LTS benötigt daher eine neue Linux-Flex-Consumption-Komposition mit Functions Runtime v4. Die Migration bleibt technisch und ändert weder Produktfunktion noch API-Vertrag noch Persistenzmodell.

Die gewünschte Ausführung ist strikt sequenziell: WA-15-Evidence, neue explizite `APPROVE`, erneuter read-only Preflight, Backend-/IaC-Vorbereitung, Clean Build und Tests einschließlich des lokalen `backend/npm run dev`-Gates, Flex-DEV-Provisionierung, vollständige DEV-Validierung mit einem Infrastructure-verantworteten `DEV-GATE`-Handoff und harter PASS/STOP-Bedingung, Alpha-Provisionierung, Hash-identischer Artefakt-Deploy, verpflichtender `preview-flex`-EAS-Build, fokussierter Alpha-Smoke, danach das explizite Y1-Decommission, Hintergrund-Queue-/Timer-Smoke, Dokumentation und der abschließende QA-Nachweis. Ein `STOP` wegen eines Planannahmenfehlers oder einer phasenbezogenen Voraussetzung führt zum Planner zurück und benennt den konkreten Nachweis, der vor einer neuen Freigabe nachzuliefern ist.

Der Queue-Fix bleibt minimal. `reusable-items-enrich` erhält für Producer und Trigger dieselbe explizite Business-Storage-Einstellung. Die Anwendung darf für diese Queue weder bevorzugt noch ersatzweise die Flex-Host-Storage-Einstellung lesen.

Die folgenden Betriebsentscheidungen sind als Zielwerte festgelegt und read-only bestätigt: `Always Ready = 0`, `Maximum Instances = 5` sowie eine dedizierte Application-Insights-Instanz für Flex. Der Quickstart-Befund `@minValue(40)` bleibt als Template-Input-Guard dokumentiert und darf nicht als Ersatzwert oder als globales App-Limit interpretiert werden. Die dokumentierte Standard-Flex-Quota gilt als ausreichende Arbeitsbasis für den geplanten kleinen DEV-/Alpha-Workload; der Plan behauptet keinen präzisen aktuellen subscription-spezifischen Flex-Memory-Wert. WP-IR03 und WP-IR05 kontrollieren nach Provisionierung mit Evidence, ob der Workload unterstützt wird; Unterversorgung oder eine widersprochene Standardbasis ist ein harter Stop mit den WA-06-Codes. Die aktuelle Quota-Abfrage vom `2026-09-29T08:07:32.984Z` lieferte nur klassische VM-Metriken. Das Blob-Listing scheiterte für beide Business-Storages an der Data-Plane-Berechtigung; eine Blob-Inventur oder ein Digest ist für diese Migration nicht erforderlich. Es gibt keine Provider-Registrierung, Quota-Erhöhung, Contributor-Eskalation oder Behauptung fehlender Blob-Daten.

Die dedizierte Flex-Application-Insights-Instanz bleibt von der Legacy-Y1-Telemetrie getrennt. Bestehende DEV-/Alpha-Business-Storage-Ressourcen, Queues, Blob-Container und Blob-Daten werden unverändert weiterverwendet. Es gibt keine Storage-Migration, keinen Queue-Wechsel, keinen Blob-Datenumzug und kein Ersetzen bestehender Business-Storage-Ressourcen. Falls Flex eigenes Host Storage verlangt, darf dieses ausschließlich als plattformtechnisches Host Storage modelliert werden und niemals bestehendes Business Storage ersetzen oder als Ziel einer Datenverschiebung dienen.

### Befundklassifikation des gemeldeten WP-IR01-STOP

| Befund | Klassifikation | Planreaktion |
|---|---|---|
| `maximumInstanceCount = 5` | Read-only bestätigt: `SUPPORTED` im Flex-Instance-Scope | Zielwert bleibt `5`; WP-IR03/WP-IR05 führen nur den verpflichtenden Post-GET aus. `40` ist kein Ersatz. |
| Explizite Darstellung `Always Ready = 0` | Read-only bestätigt: `SUPPORTED` | Explizite `instanceCount: 0`-Darstellung bleibt bestehen; WP-IR03/WP-IR05 führen den Post-GET aus. |
| Azure-Identität war `Contributor` auf Subscription-Scope | Echter Planannahmenfehler `PLAN-ASSUMPTION-INVALID:WA-15` | Subscription-/Cloud-Owner stellt eine dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller` samt read-only Assignment-Review bereit. Ohne geplante Role Assignments genügt diese RG-scoped-Basis; bei geplanten Assignments sind exakt erforderliche Permission(s), Scopes und Allowlist nachzuweisen. Keine Owner-/Subscription-Contributor-Eskalation, breite Berechtigung oder RBAC-Selbstreparatur durch den Executor. |
| Flex-Subscription-Memory-Quota | Historische Messlücke `UNVERIFIED-QUOTA`, unter der revidierten Policy nicht blockierend | Die dokumentierte Standard-Flex-Quota ist die Arbeitsbasis für den kleinen Workload. WP-IR01 behauptet keinen aktuellen Messwert; WP-IR03/WP-IR05 liefern die Post-Provisioning-Quota-Kontrolle. Keine Provider-Registrierung und keine Quota-Erhöhung. |
| Blob-Daten nicht listbar wegen fehlendem `Storage Blob Data Reader` | Historische Data-Plane-Evidence `UNVERIFIED-BLOB-DATA-READER`, unter der revidierten Policy nicht erforderlich; kein Datenverlustbefund | Keine Blob-Inventur oder Data-Reader-Auflösung. Control-Plane-Resource-Referenzen, Setting-/Resource-Matrix, What-if-Allowlist und No-Mutation-Evidence bleiben verbindlich; tatsächliche Mutation oder Migration ist STOP. |
| Zukünftige Flex-Application-Insights- und Host-Storage-IDs fehlen im Preflight | Erwarteter Ausgangszustand, kein Fehler | WP-IR01 prüft Contract, Naming, Scope, Identity/RBAC und What-if-Allowlist; WP-IR02/WP-IR03 erzeugen und belegen die Ressourcen. |
| Queue-Producer fällt aktuell auf `AzureWebJobsStorage` zurück und Trigger nutzt es | Bekannte Implementierungslücke, kein Preflight-Blocker | WP-B01 behebt und testet den expliziten Business-Storage-Vertrag nach bestandenem Preflight. |
| DEV/Alpha laufen aktuell mit Node 20/22, IaC zeigt Node 22 | Bestätigter Ausgangszustand / Migrationsumfang | Neue Flex-Apps erhalten Node 24; bestehende Y1-Apps werden nicht auf Node 24 umgestellt. |

**Open Product Owner Decisions:** Keine. Die aktuelle `APPROVE`-Freigabe fehlt; technische Abweichungen werden ausschließlich nach dem Plan-Assumption-Failure-Protokoll an den Planner zurückgegeben.

## 2. Feature Summary

- neue Linux-Flex-Consumption-Function-App mit Node 24 LTS und Functions Runtime v4;
- read-only Verifikation von Flex-Schema, Region, dokumentierter Standard-Quota-Basis, Runtime und Package-Deployment vor jeder Azure-Mutation sowie harte Quota-Kontrolle nach DEV-/Alpha-Provisionierung;
- referenzierende DEV-/Alpha-IaC ohne neue Cosmos-Container, Datenkopien oder neue gemeinsame AI-/CIAM-Ressourcen;
- konsistente Node-24-Manifeste und ein sauberer Linux-x64-Artefaktpfad für `sharp` und `@resvg/resvg-js`;
- explizite Zuordnung von Business Storage und Flex Host Storage für Producer und Queue-Trigger;
- vollständige technische DEV-Validierung vor jeder Alpha-Mutation;
- Alpha mit demselben Backend-Artefakt-Hash wie DEV und einem fokussierten Smoke;
- vorgegebene und im WP-IR01-Handoff vom 2026-09-29 read-only bestätigte Zielwerte `Always Ready = 0` und `Maximum Instances = 5` im exakten Flex-Property-/Dienst-Scope; die Quickstart-Constraint `@minValue(40)` bleibt als Template-Input-Guard dokumentiert und ist keine stillschweigende Ersetzung des Zielwerts;
- ein hartes read-only Scope-Gate für `Maximum Instances = 5` und `Always Ready = 0`; bei Abweichung endet die aktuelle Planversion vor Mutation mit dem exakten Annahmen-Fehlercode;
- separate Flex-Application-Insights-Instanz, strikt getrennt von der Legacy-Y1-Telemetrie;
- unveränderte Weiterverwendung bestehender DEV-/Alpha-Business-Storage-Ressourcen einschließlich Queues, Blob-Container und Blob-Daten ohne Storage-Migration, Queue-Wechsel oder Blob-Datenumzug;
- Legacy-Y1-Schutz bis zum erfolgreichen Alpha-Smoke, danach gezieltes Decommission ohne dauerhaft laufende Legacy-Instanz;
- Wiederherstellung aus versioniertem Git-, IaC-, Parameter- und Release-Artefakt;
- genau ein einfacher `preview-flex`-EAS-Konfigurationsschritt und ein verpflichtender neuer EAS-Build, weil `EXPO_PUBLIC_API_URL` build-time eingebettet wird und der fokussierte Alpha-Smoke den direkten Flex-Host über den bestehenden Mobile-Client prüfen soll.

### Eindeutiges Zielbild

| Bereich | Zielbedingung nach erfolgreicher Migration |
|---|---|
| Azure-Scope | Bestehende Resource Group `rg-Michael-Mueller`, Region `northeurope`; keine neue Resource Group. |
| Hosting | Je Environment eine neue Linux Azure Functions Flex Consumption Function App mit FC1; bestehende Y1-Apps bleiben bis zum Alpha-Smoke unverändert. |
| Runtime | Functions Runtime v4, Node 24 LTS, ARM-/Provider-Scope aus WA-03; `Always Ready = 0`, `Maximum Instances = 5` im verifizierten Flex-Instance-Scope. |
| Environment-Zuordnung | Flex-DEV verwendet ausschließlich DEV-Cosmos und DEV-Business-Storage; Flex-Alpha ausschließlich Alpha-Cosmos und Alpha-Business-Storage. |
| Host-/Deployment-Storage | Das vom Flex-Vertrag verlangte Host-/Deployment-Storage wird je Environment plattformtechnisch getrennt modelliert und niemals als Business-Storage oder Datenmigrationsziel verwendet. WA-09 ist vor IaC zu bestätigen. |
| Business Storage | Bestehende Business-Storage-Accounts, `reusable-items-enrich`, `recipe-images`, `label-scans` und deren Daten bleiben unverändert; `STORAGE_CONNECTION_STRING` ist der einzige Business-Queue-/Blob-Pfad. |
| Cosmos | Bestehende DEV-/Alpha-Cosmos-Accounts, Datenbank `fittrack-db`, Container und Partition Keys bleiben unverändert; keine neuen Container und keine Migration. |
| Shared Services | Azure OpenAI, Document Intelligence und CIAM bleiben die bestehenden shared Dienste; keine neuen Instanzen und keine API-/Auth-Vertragsänderung. |
| Telemetrie | Jede Flex-App verwendet eine eigene dedizierte Application-Insights-Zuordnung mit eigener Resource-ID, getrennt von der Legacy-Y1-Telemetrie. |
| Deployment | Clean Build aus `_deploy_staging/`, Remote-Oryx `--build remote --javascript`, Linux-x64-Native-Gate; DEV und Alpha erhalten denselben Backend-Artefakt-Hash. |
| Mobile | `preview-flex` zeigt direkt auf den Alpha-Flex-Host einschließlich `/api`; genau ein neuer installierbarer EAS-Build vor dem Alpha-Smoke, ohne native Änderung. |
| Rollout | Read-only Preflight, Backend-/IaC-Vorbereitung, DEV-Provisionierung/-Gate, Alpha-Provisionierung/-Deploy, `preview-flex`-Build, Alpha-Smoke, erst danach Y1-Decommission und Hintergrund-Smokes. |

## 3. Current Behaviour

- [`infra/main.bicep`](../../../infra/main.bicep) erstellt pro Environment Cosmos DB, Storage, Monitoring, Document Intelligence und die aktuelle Function-App-Komposition.
- [`infra/main.bicep`](../../../infra/main.bicep) verdrahtet aktuell die bestehende Monitoring-Komposition; eine separate Flex-Application-Insights-Instanz und ihre Abgrenzung von der Legacy-Y1-Telemetrie sind im aktuellen Y1-Stand noch nicht modelliert.
- [`infra/modules/functionapp.bicep`](../../../infra/modules/functionapp.bicep) beschreibt derzeit einen Linux-Consumption/Y1-Plan mit `linuxFxVersion: Node|22`, `WEBSITE_NODE_DEFAULT_VERSION: ~22` und Functions Runtime v4.
- Root-Manifest, [`backend/package.json`](../../../backend/package.json) und [`_deploy_staging/package.json`](../../../_deploy_staging/package.json) erlauben aktuell Node `>=22.0.0`.
- [`backend/package.json`](../../../backend/package.json) definiert den lokalen Start als `"dev": "node scripts/dev.mjs"`; der exakte lokale Aufruf erfolgt aus `backend/`.
- [`backend/scripts/dev.mjs`](../../../backend/scripts/dev.mjs) baut vor dem Start, prüft Port 7071, startet oder erkennt Azurite, wartet auf die drei HTTP-Dienste, legt `reusable-items-enrich` an und startet danach `func start`.
- [`backend/README.md`](../../../backend/README.md) dokumentiert `local.settings.json`, Azure Functions Core Tools, `npm install` und den Health-Check. `backend/local.settings.json` bleibt über die Root-`.gitignore` ausgeschlossen; lokale Settings und Emulator-Konfigurationen sind keine Flex-Host-Storage-Konfiguration.
- Das Root-[`package.json`](../../../package.json) besitzt kein eigenes `dev`-Script; der lokale Backend-Gate ist daher kein Root-Aufruf `npm run dev`.
- [`backend/src/lib/queueClient.ts`](../../../backend/src/lib/queueClient.ts) liest aktuell zuerst `AzureWebJobsStorage` und fällt danach auf `STORAGE_CONNECTION_STRING` zurück.
- [`backend/src/functions/reusableItemsEnrich.ts`](../../../backend/src/functions/reusableItemsEnrich.ts) bindet den Queue-Trigger aktuell mit `connection: 'AzureWebJobsStorage'`.
- [`backend/src/functions/reusableItems.ts`](../../../backend/src/functions/reusableItems.ts) und [`backend/src/functions/reusableItemsEnrichScheduler.ts`](../../../backend/src/functions/reusableItemsEnrichScheduler.ts) benutzen dieselbe Queue-Funktion fachlich für Create/Update und den nächtlichen Nachholpfad.
- [`backend/src/lib/storage.ts`](../../../backend/src/lib/storage.ts) verwendet `STORAGE_CONNECTION_STRING` bereits als Anwendungseinstellung für Business-Blob-Zugriffe. Diese Einstellung wird für den Queue-Vertrag als Business Storage festgelegt.
- [`backend/src/index.ts`](../../../backend/src/index.ts) registriert `GET /api/health` anonym mit HTTP 200 und dem bestehenden Health-Body. Geschützte Funktionen validieren Tokens über `requireUser()`.
- [`mobile/src/shared/api/client.ts`](../../../mobile/src/shared/api/client.ts) nimmt `EXPO_PUBLIC_API_URL` zur Buildzeit aus der Umgebung. [`mobile/eas.json`](../../../mobile/eas.json) enthält derzeit eine Preview-URL für den bestehenden Alpha-Y1-Host, aber kein `preview-flex`-Profil.
- DEV und Alpha verwenden getrennte Cosmos- und Business-Storage-Ressourcen. Azure OpenAI, Document Intelligence und CIAM sind absichtlich gemeinsam genutzt.
- Der aktuelle IaC-Stand bildet Storage und Monitoring noch in der bestehenden Y1-Komposition ab; die Migration muss Business Storage unverändert referenzieren und Flex-Host-Storage sowie Flex-Telemetrie getrennt nach dem verifizierten Vertrag modellieren.
- Der Renderer benötigt `sharp`, `@resvg/resvg-js` und die vollständige Asset-Struktur aus dem Backend-Build. Windows-`node_modules` sind kein Nachweis für die Azure-Linux-Laufzeit.

## 4. Desired Behaviour

- Die neue Function-App läuft nach verifiziertem Azure-Vertrag auf Linux Flex Consumption, Node 24 LTS und Functions Runtime v4.
- DEV verwendet ausschließlich DEV-Cosmos und DEV-Business-Storage; Alpha verwendet ausschließlich Alpha-Cosmos und Alpha-Business-Storage. Shared Azure OpenAI, Document Intelligence und CIAM bleiben unverändert gemeinsam genutzt.
- `AzureWebJobsStorage` beziehungsweise das vom Flex-Vertrag geforderte Host-Storage-Setting bleibt Plattformkonfiguration. `STORAGE_CONNECTION_STRING` ist die explizite Business-Storage-Einstellung für Blob-Zugriffe und die Queue `reusable-items-enrich`.
- Producer und Queue-Trigger verwenden dieselbe Einstellung `STORAGE_CONNECTION_STRING` und denselben Queue-Namen. Es gibt keinen Fallback auf Host Storage.
- HTTP-Routen, Methoden, DTOs, Auth-Audience, User-Isolation, Response- und Error-Verträge bleiben unverändert.
- `GET /api/health` liefert 200; ein geschützter Endpoint ohne gültigen Token liefert 401; ein vorhandener gültiger CIAM-Testuser kann die vorgesehenen Testflüsse ausführen.
- Der `preview-flex`-Build enthält nur den direkten Flex-Host mit `/api` sowie die bestehenden öffentlichen CIAM-, Variant- und Package-Werte. Es gibt keine neue Routing-, Gateway- oder DNS-Schicht.
- Für die Flex-Komposition gelten `Always Ready = 0` und `Maximum Instances = 5`. WP-IR01 vom 2026-09-29 hat beide Werte im vorgesehenen Flex-Scope read-only bestätigt; der Property-Pfad für `5` ist auf das Flex-Instance-Limit zu begrenzen und darf nicht als globales App- oder pauschales Gesamtlimit der Function App umgedeutet werden. WP-IR03 und WP-IR05 lesen die Werte nach Provisionierung erneut.
- Eine spätere Dienst-/Provider-Abweichung von `5` würde `PLAN-ASSUMPTION-INVALID:WA-04` plus `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED` auslösen; eine spätere nicht entscheidbare Revalidierung würde `UNVERIFIED-MAXIMUM-INSTANCE-SCOPE` auslösen. Der Orchestrator startet dann keine Mutation und ruft den Planner mit dem vollständigen Handoff zurück. `40` bleibt verboten.
- Flex verwendet eine separate Application-Insights-Instanz mit eigener Resource-ID/Connection-String-Zuordnung. Die Legacy-Y1-Telemetrie bleibt getrennt, wird nicht als Flex-Telemetrie wiederverwendet und nicht durch sie ersetzt.
- Bestehende DEV-/Alpha-Business-Storage-Ressourcen, Queues, Blob-Container und Blob-Daten bleiben unverändert und werden weiterverwendet. Es gibt keine Storage-Migration, keinen Queue-Wechsel, keinen Blob-Datenumzug und kein Ersetzen bestehender Ressourcen. Ein eventuell erforderliches Flex-Host Storage ist ausschließlich plattformtechnisch.
- Der neue `preview-flex`-EAS-Build ist trotz reiner URL-/JS-Konfiguration verpflichtend, weil `EXPO_PUBLIC_API_URL` build-time eingebettet wird. Native Module, Config-Plugins, `app.config.js`, Package-IDs, Screens und Navigation ändern sich nicht.
- Nach jeder Änderung an Manifesten, Lockfiles oder Backend-Code besteht ein verbindliches lokales Startup-/Smoke-Gate: aus `backend/` wird exakt `npm run dev` ausgeführt. Der Nachweis umfasst den erfolgreichen integrierten Build, die Bereitschaft von Azurite einschließlich der lokalen Queue `reusable-items-enrich`, einen Functions-Host auf Port 7071, `GET http://localhost:7071/api/health` mit HTTP 200 sowie eine kontrollierte, saubere Beendigung. Fehler werden der fehlgeschlagenen Phase (Build, Port, Azurite/Queue, Functions-Host oder Health) zugeordnet.
- Für dieses Gate sind Node 24 LTS/npm, installierte Workspace-Abhängigkeiten (`npm install` aus dem Repository-Root), Azure Functions Core Tools v4, eine lokale `backend/local.settings.json` aus dem Template und ein freier Port 7071 erforderlich. `local.settings.json` bleibt gitignored; Secretwerte erscheinen weder im Plan noch in Logs, Handoffs oder Release-Evidence. Lokale Azurite-/Emulator-Settings, einschließlich `UseDevelopmentStorage=true` beziehungsweise lokaler Emulator-Endpunkte, sind keine Flex-Host-Storage-Einstellungen und lösen keine Azure-Ressourcenänderung aus.
- Alpha erhält denselben Backend-Artefaktstand wie DEV. Der bestehende Y1-Stack bleibt bis zum Alpha-Smoke unangetastet.
- Erst nach bestandenem Alpha-Smoke werden nur die nicht mehr benötigten Y1-Hostingressourcen entfernt, Flex-Queue-Trigger und Flex-Timer aktiviert und je ein kontrollierter Queue- und Timer-Smoke ausgeführt.
- Nach dem Decommission existiert keine laufende Legacy-Instanz als Rückfallbetrieb. Eine Wiederherstellung baut bei Bedarf aus versioniertem Git-, IaC-, Parameter- und Release-Artefakt auf.

## 5. Scope

### In Scope

- Node-24-LTS-Kompatibilität der Root-, Backend- und Staging-Manifeste;
- Flex-Schema-, Runtime-, Region-, Quota- und Package-Deployment-Preflight;
- referenzierende Flex-IaC für DEV und Alpha einschließlich Host-Storage, App Settings, Identity und Monitoring;
- minimaler Queue-Fix für Producer und Trigger mit expliziter Business-Storage-Verbindung;
- Clean Build, Tests, Asset-Mirror und Linux-x64-Native-Gates;
- DEV-Provisionierung und vollständige technische DEV-Validierung;
- Alpha-Provisionierung, Hash-identischer Backend-Deploy und fokussierter Smoke;
- einmalige `preview-flex`-Konfiguration in `mobile/eas.json` ohne native Änderungen und der danach verpflichtende neue EAS-Build für den fokussierten Alpha-Client-Smoke;
- read-only Nachweis der Scope-/Schema-Zulässigkeit von `Always Ready = 0` und `Maximum Instances = 5` sowie der separaten Flex-Application-Insights-Instanz; eine IaC-Abbildung erfolgt erst nach bestandenem Gate und unverändert mit den Zielwerten;
- explizite Control-Plane-Resource-/Setting-/Queue-/Container-/What-if-Evidence, dass bestehende DEV-/Alpha-Business-Storage-Ressourcen unverändert weiterverwendet werden und keine Storage-Migration stattfindet; keine Blob-Dateninventur als Voraussetzung;
- kontrolliertes Decommission des Y1-Hostings nach Alpha-Smoke und anschließender Queue-/Timer-Smoke;
- Git-/IaC-/Artefakt-basierte Recovery-Dokumentation sowie Release-, KB- und QA-Nachweise.

## 6. Out of Scope

- Änderungen an Screens, Navigation, Mobile-Fachlogik, API-Routen oder fachlichen Nutrition-/AI-Regeln;
- neue Cosmos-Container, neue Dokumentfelder, Datenkopien, Backfills oder Datenmigrationen;
- neue Azure OpenAI-, Document-Intelligence- oder CIAM-Ressourcen;
- eine Traffic-Routing-, Gateway-, Front-Door- oder DNS-Lösung;
- eine länger laufende Doppel-Hosting-Architektur nach dem Alpha-Smoke;
- Änderungen an Shared Cosmos, Business Storage, OpenAI, Document Intelligence oder CIAM beim Y1-Decommission;
- Storage-Migration, Queue-Wechsel, Blob-Datenumzug oder Ersetzen bestehender DEV-/Alpha-Business-Storage-Ressourcen; auch ein Flex-Host-Storage darf nicht als Business-Storage-Ersatz dienen;
- Wiederverwendung der Legacy-Y1-Telemetrie als Flex-Telemetrie oder Löschung der erforderlichen separaten Flex-Application-Insights-Instanz;
- Queue- oder Timer-Orchestrierung mit mehreren Zustandswechseln. Es gibt nur den einen kontrollierten Smoke nach Aktivierung der Flex-Hintergrundfunktionen.

## 7. Confirmed Facts

| Quelle | Bestätigter Fakt |
|---|---|
| `docs/kb/tech/01-system-overview.md` | DEV und Alpha sind getrennte Laufzeit-/Datenumgebungen; OpenAI, Document Intelligence und CIAM sind shared. |
| `docs/kb/tech/07-infrastructure.md` | Die bestehende Azure Function läuft auf Linux Node 22; Node 24 ist der Flex-Migrationspfad. Deployments laufen aus `_deploy_staging/` mit Linux-kompatiblem Build. |
| `docs/kb/tech/02-backend.md` | `npm run build:verify` baut das Backend und prüft den vollständigen Renderer-Asset-Mirror. `STORAGE_CONNECTION_STRING` ist der vorhandene Anwendungspfad für Storage. |
| `docs/kb/tech/05-authentication.md` | Backend-JWT-Validierung über CIAM/JWKS und User-Isolation bleiben serverseitig unverändert. |
| `docs/kb/tech/08-testing.md` | Backend-, Shared- und Mobile-Typechecks sowie Vitest-Gates laufen paketbezogen; Contract-Tests verwenden ausschließlich den Emulator. |
| `backend/package.json`, `backend/scripts/dev.mjs` | Das Script `npm run dev` wird aus `backend/` ausgeführt, baut zuerst, prüft Port 7071, stellt Azurite und `reusable-items-enrich` bereit und startet anschließend `func start`. |
| `backend/README.md`, Root-`.gitignore` | Lokale Voraussetzungen sind `local.settings.json`, Azure Functions Core Tools, installierte Abhängigkeiten und der Health-Check; `backend/local.settings.json` bleibt gitignored und wird nicht mit Secretwerten nach außen dokumentiert. |
| Root-`package.json` | Es gibt kein Root-`dev`-Script; der lokale Startup-Gate verwendet ausschließlich `npm run dev` aus `backend/`. |
| `backend/src/index.ts` | `health` ist registriert und liefert anonym HTTP 200. |
| `backend/src/lib/queueClient.ts` | Der aktuelle Producer hat einen unerwünschten Host-Storage-Fallback. |
| `backend/src/functions/reusableItemsEnrich.ts` | Der aktuelle Trigger ist an `AzureWebJobsStorage` gebunden. |
| `backend/src/functions/reusableItemsEnrichScheduler.ts` | Der Scheduler requeued nicht angereicherte Items über denselben Producer. |
| Nutzerkorrektur für diesen Plan | `Always Ready = 0`, `Maximum Instances = 5` und eine separate Application-Insights-Instanz für Flex sind getroffene Betriebsentscheidungen, keine offenen Produktentscheidungen. |
| WP-IR01-Handoff vom 2026-09-29 | `Maximum Instances = 5` ist im exakten Flex-Instance-Scope `SUPPORTED`: `Microsoft.Web/sites@2024-04-01`, `properties.functionAppConfig.scaleAndConcurrency.maximumInstanceCount`, ARM-Typ `int`, Quickstart-Decorator als Template-Input-Guard und read-only What-if mit `5`; `40` wird nicht verwendet. |
| WP-IR01-Handoff vom 2026-09-29 | `Always Ready = 0` ist explizit `SUPPORTED`: `properties.functionAppConfig.scaleAndConcurrency.alwaysReady[]` und read-only What-if mit `http: { instanceCount: 0 }`; der spätere GET in WP-IR03/WP-IR05 bleibt erforderlich. |
| Nutzerkorrektur für diesen Plan | Bestehende DEV-/Alpha-Business-Storage-Ressourcen, Queues, Blob-Container und Blob-Daten bleiben unverändert; es gibt keine Storage-Migration, keinen Queue-Wechsel und keinen Blob-Datenumzug. |
| Nutzerkorrektur für diesen Plan | Der neue `preview-flex`-EAS-Build ist wegen der build-time eingebetteten API-URL verpflichtend; die Konfiguration bleibt ohne native Änderung. |
| `mobile/src/shared/api/client.ts` | Die API-Basis-URL ist build-time und benötigt den `/api`-Suffix. |
| WP-IR01-Handoff vom 2026-09-29 | Subscription `Microsoft Azure Sponsorship 26/27-1`, Resource Group `rg-Michael-Mueller`, Region `northeurope`, Status `Succeeded`, `Microsoft.Web: Registered`, Flex-Unterstützung und Node 24 mit Functions v4 wurden read-only bestätigt; DEV-Y1 bleibt Node 20, Alpha-Y1 Node 22. |
| WP-IR01-Handoff vom 2026-09-29 | Flex-Memory-Quota ist über `Microsoft.Web/locations/northeurope/usages?api-version=2026-08-01` nicht bestätigt; die Antwort enthielt nur klassische VM-Metriken. Historisches Ergebnis: `UNVERIFIED-QUOTA`; `Microsoft.Quota` wurde nicht registriert. Unter der revidierten Policy ist dies keine Preflight-Blockade; die dokumentierte Standard-Quota bleibt die Arbeitsbasis und wird nach Provisionierung kontrolliert. |
| WP-IR01-Handoff vom 2026-09-29 | Blob-Data-Listing für DEV und Alpha war wegen fehlender Data-Plane-Berechtigung nicht möglich. Historisches Ergebnis: `UNVERIFIED-BLOB-DATA-READER`; daraus folgt keine Aussage über fehlende Blob-Daten. Eine Blob-Inventur oder Data-Reader-Auflösung ist für diese Migration nicht erforderlich. |
| WP-IR01-Handoff vom 2026-09-29 | Die ausführende CLI-Identität war `Contributor` auf Subscription-Scope. Das verletzt `WA-15` unter der alten und revidierten Scope-Regel und ist `PLAN-ASSUMPTION-INVALID:WA-15`; keine neue Ausführung darf diese Identität verwenden. Eine neue dedizierte RG-scoped-`Contributor`-Identität erfüllt den revidierten Vertrag nur, wenn die geplante IaC keine Role Assignments erstellt; andernfalls sind die exakt erforderlichen targeted Permission(s), Scopes und die Assignment-Allowlist zusätzlich read-only zu bestätigen. |
| WP-IR01-Handoff vom 2026-09-29 | `Result: STOP`, `Mutation: NO`; WP-B01 und alle Folge-WPs sind blockiert. Die zulässige What-if-Allowlist und die noch nicht vorhandenen zukünftigen Flex-Application-Insights-/Host-Storage-IDs wurden read-only bestätigt. |
| Repository gegen `docs/kb/tech/02-backend.md` | Der aktuelle Code und `backend/local.settings.json.template` verwenden `STORAGE_CONNECTION_STRING`; die Environment-Variable-Tabelle der KB nennt abweichend `AZURE_STORAGE_CONNECTION_STRING`. Für diese Migration gilt die Implementierung als Ist-Quelle; die KB-Abweichung wird nach dem Release als Planner-Nacharbeit korrigiert. |
| Repository gegen `.github/instructions/infra-release.instructions.md` | Der aktuelle `backend/src/index.ts` registriert `GET /api/health` mit HTTP 200, obwohl die ältere Infrastructure-Anweisung noch den interimistischen 401-Check beschreibt. Der Plan verwendet den aktuellen implementierten Health-Vertrag und weist die Dokumentationsdivergenz aus. |

## 8. Assumptions and Open Questions

**Open Product Owner Decisions:** Keine. Alle technischen Annahmen und ihre Prüfverträge stehen in `Working Assumptions and Validation`. Sie sind keine stillen Architekturentscheidungen.

**Execution gating:** Vor einer neuen `APPROVE` muss ausschließlich die externe WA-15-Auflösung vollständig und secretfrei vorliegen: die tatsächliche dedizierte Deployment-Identität, `Contributor` ausschließlich auf `rg-Michael-Mueller` und die read-only Prüfung, ob die geplante IaC neue Role Assignments erstellt. Ohne Role Assignments ist RG-scoped `Contributor` die Basis; mit Role Assignments müssen nur die exakt erforderlichen Permission(s), Assignment-Scopes und die Assignment-Allowlist bestätigt werden. Subscription-`Contributor`, `Owner` und breite Eskalationen sind ausgeschlossen; nicht read-only bestätigbare Permission- oder Scope-Evidence lautet `UNVERIFIED-PERMISSIONS`/`STOP`. EAS-Berechtigung wird erst im späteren EAS-WP geprüft und ist kein Pre-Approval-Blocker. Danach startet ausschließlich WP-IR01 erneut read-only. `UNVERIFIED-QUOTA` blockiert weder diese `APPROVE` noch WP-IR01 noch WP-B01; die dokumentierte Standard-Flex-Quota ist die Arbeitsbasis und wird erst nach Provisionierung hart kontrolliert. `UNVERIFIED-BLOB-DATA-READER` blockiert nicht und verlangt keine Auflösung, weil keine Blob-Inventur/Digest erforderlich ist. Ein WP-IR01-`PASS` liegt vor, wenn alle blockierenden Annahmen bestätigt sind; die beiden historischen beziehungsweise optionalen Statuswerte dürfen ausdrücklich als nicht blockierende Evidence vermerkt werden. `STOP` und ein blockierendes `UNVERIFIED` entsperren kein Folge-WP. Bei einer tatsächlichen Abweichung gilt das Plan-Assumption-Failure-Protokoll; eine neue Planversion benötigt erneut `APPROVE`.

**Externe Voraussetzungen und Owner:**

- Der Subscription-/Cloud-Owner muss vor dem erneuten WP-IR01 die tatsächliche phasenbezogene Azure-Deployment-Identität, ihren `Contributor`-Scope ausschließlich auf `rg-Michael-Mueller` und die vollständige read-only Assignment-Prüfung bereitstellen. Wenn die geplante IaC keine Role Assignments erstellt, ist RG-scoped `Contributor` die ausreichende Basis. Wenn Flex Host Storage, Managed Identity oder ein anderer IaC-Teil Role Assignments erstellt, werden nur die exakt erforderlichen Permission(s) am engsten erforderlichen Assignment-Scope aufgenommen und per Assignment-Allowlist dokumentiert. Der bisherige Subscription-`Contributor`, jede Owner-Rolle und breite Eskalation sind gesperrt. Nicht read-only bestätigbare Permission- oder Scope-Evidence lautet `UNVERIFIED-PERMISSIONS`/`STOP`; der Executor darf keine eigene Azure-RBAC-Reparatur ausführen. EAS-Berechtigung wird erst im späteren EAS-WP geprüft und ist kein Pre-Approval-Blocker.
- Der Subscription-/Cloud-Owner muss keine subscription-spezifische Flex-Memory-Quota-Evidence vor dem erneuten WP-IR01 liefern. Die dokumentierte Standard-Flex-Quota wird für den geplanten kleinen DEV-/Alpha-Workload als ausreichende Arbeitsbasis festgehalten, ohne einen aktuellen Flex-Memory-Wert zu behaupten. `Microsoft.Quota` darf nicht registriert und kein Quota-Increase darf nur zum Bestehen eines Gates beantragt werden. WP-IR03 und WP-IR05 liefern die verpflichtende Post-Provisioning-Kontrolle mit Quelle und Zeitpunkt; tatsächliche Unterversorgung oder eine widersprochene Standardbasis ist ein harter Stop.
- Der Storage-Owner muss keine `Storage Blob Data Reader`-Berechtigung und keine Blob-Inventar-/Digest-Evidence bereitstellen. Control-Plane-Resource-Referenzen, Settings, Queue-/Container-GETs, What-if-Allowlists und No-Mutation-Evidence bleiben verbindlich. Fehlender Data-Reader ist kein Blocker und beweist weder fehlende noch vorhandene Blob-Daten. Eine tatsächliche Business-Storage-/Blob-Mutation oder Migration bleibt ein harter Stop.
- Infrastructure benötigt die EAS-Berechtigung für den verpflichtenden `preview-flex`-Build, einen kontrollierten CIAM-Testuser und die vorgesehenen Secretquellen. Secretwerte erscheinen ausschließlich in den lokalen/Azure-Secretquellen, nie in Plan, Logs, Handoffs oder Release-Evidence.
- Backend benötigt für das lokale Gate Node 24/npm, installierte Workspace-Abhängigkeiten, Azure Functions Core Tools v4, eine lokale gitignored `backend/local.settings.json` und einen freien Port 7071. Das lokale Gate verändert keine Azure-Ressource.

**Keine Entscheidungsschleife:** `5` und `0` sind im aktuellen read-only Handoff unterstützt. Bei einer späteren Abweichung vom Zielvertrag, beim Host-Storage-Modell oder bei der Telemetrie-Trennung wird die aktuelle Planversion beendet. Der Agent wartet auf eine revidierte Planner-Version; er setzt weder `40` noch einen Default, eine alternative Hosting-Architektur oder einen stillen Ersatzpfad ein.

## 9. Existing Components to Reuse

- `infra/main.bicep` und die bestehenden Module für Naming, Tags, Umgebung und Resource-Group-Schutz;
- bestehende DEV-/Alpha-Cosmos-Accounts und Container;
- bestehende DEV-/Alpha-Business-Storage-Accounts, Blob-Container und Queue `reusable-items-enrich`;
- bestehende Shared-Azure-OpenAI-, Document-Intelligence- und CIAM-Dienste;
- bestehende Legacy-Y1-Telemetrie als getrennte Referenz sowie eine neu zu modellierende dedizierte Flex-Application-Insights-Instanz;
- bestehende DEV-/Alpha-Business-Storage-Accounts, Queues, Blob-Container und Blob-Daten als unverändert weiterzuverwendende Ressourcen;
- `backend/src/lib/storage.ts`, `backend/src/lib/queueClient.ts`, `reusableItems.ts`, `reusableItemsEnrich.ts` und `reusableItemsEnrichScheduler.ts`;
- `backend/scripts/copy-instagram-assets.mjs`, `backend/scripts/verify-build.mjs` und `_deploy_staging/`;
- bestehender Health-, Auth-, API- und Renderer-Vertrag;
- bestehende Expo-/EAS-Profile und der bestehende Axios-Client.

## 10. Proposed Technical Solution

### Runtime and package contract

Das erneute WP-IR01 verifiziert read-only die aktuell unterstützte Flex-SKU, API-Version, Region, Runtime-Auswahl, Functions Runtime v4, Host-/Deployment-Storage-Anforderungen, die dokumentierte Standard-Quota-Basis, Permissions und den Remote-Oryx-Package-Deploy. Der Handoff vom 2026-09-29 hat `maximumInstanceCount = 5` und `Always Ready = 0` bereits im exakten Flex-Scope als `SUPPORTED` bestätigt. Das erneute WP-IR01 prüft diese Befunde auf Drift, trennt weiterhin Template-Parameter/Decorator, ARM-/Provider-Schema und Dienstvalidierung und verlangt keine zukünftige Flex-Application-Insights- oder Host-Storage-Resource-ID. Es behauptet keinen präzisen aktuellen subscription-spezifischen Flex-Memory-Wert; WP-IR03 und WP-IR05 kontrollieren die Workload-Unterstützung nach Provisionierung. Erst WP-IR02 legt die konkreten Bicep-Felder und Release-Befehle anhand des neuen `PASS`-Handoffs fest. Die Manifeste werden auf Node 24 LTS ausgerichtet; unnötige Dependency-Upgrades sind nicht Teil des Plans.

### Flex operating decisions and telemetry contract

`Always Ready = 0` und `Maximum Instances = 5` sind die vorgegebenen Zielwerte und im aktuellen WP-IR01-Handoff `SUPPORTED`. Für `Always Ready` werden Default, explizite Darstellung und Post-Provisioning-Wert getrennt evidenceiert. Für `Maximum Instances` belegt WP-IR01 API-Version, Property-Pfad, Template-Constraint, Provider-/Dienstregel, zulässigen Wert, Scope und die Abgrenzung zu globalem App- oder Subscription-Limit. Die aktuelle Microsoft-Evidence zeigt im Quickstart einen `maximumInstanceCount`-Parameter mit `@minValue(40)`; weil dies eine Template-Eingabeprüfung ist, wird `5` dennoch durch die erfolgreiche What-if-Validierung im exakten Flex-Scope als `SUPPORTED` bestätigt. Das erneute WP-IR01 prüft diesen Befund auf Drift und lässt `5` unverändert. Eine spätere `UNSUPPORTED`- oder `UNVERIFIED`-Revalidierung stoppt vor Mutation und führt über das Failure Protocol zum Planner zurück. Es gibt keinen stillen Ersatzwert.

WP-IR02 darf den Quickstart-Decorator `@minValue(40)` nicht unbesehen übernehmen. Bei `SUPPORTED` muss die IaC-Definition den bestätigten Provider-/Schemavertrag und unverändert den Zielwert `5` abbilden. Bei `UNSUPPORTED` oder `UNVERIFIED` beendet Infrastructure die aktuelle Planversion; `40`, eine alternative Architektur und jeder andere Wert sind in dieser Ausführung verboten.

Flex erhält eine separate Application-Insights-Instanz mit eigener Resource-ID und eigener Connection-String-Zuordnung. Diese Instanz bleibt von der Legacy-Y1-Telemetrie getrennt; der Flex-Deploy darf die Legacy-Y1-Connection nicht wiederverwenden, überschreiben oder als Ersatz behandeln. Beide Zuordnungen werden in Setting-Matrix, `what-if`, Resource-Evidence, Smoke-Abfragen und Release-Record nachgewiesen.

### Storage and queue contract

`STORAGE_CONNECTION_STRING` wird als Business-Storage-Einstellung behandelt. `enqueueEnrichment()` liest ausschließlich diese Einstellung. Der Trigger `reusable-items-enrich` verwendet in seiner Binding-Konfiguration ebenfalls `connection: 'STORAGE_CONNECTION_STRING'`. `AzureWebJobsStorage` beziehungsweise die Flex-Host-Storage-Einstellung wird weder im Producer-Code noch in der Trigger-Binding als Business-Queue-Verbindung verwendet. `ENRICH_QUEUE_NAME` bleibt `reusable-items-enrich`.

Es gibt keine Storage-Migration. Bestehende DEV-/Alpha-Business-Storage-Ressourcen, Queues, Blob-Container und Blob-Daten werden unverändert weiterverwendet und per Control-Plane-Resource-Referenz, Setting-Matrix, Queue-/Container-GETs, What-if-Allowlist und No-Mutation-Evidence geschützt. Eine Blob-Inventur, ein Digest und `Storage Blob Data Reader` sind für diese Migration nicht erforderlich und dürfen nicht als Beweis für vorhandene oder fehlende Blob-Daten interpretiert werden. Es gibt keinen Queue-Wechsel, keinen Blob-Datenumzug und kein Ersetzen bestehender Business-Storage-Ressourcen. Falls der verifizierte Flex-Vertrag eigenes Host-/Deployment-Storage verlangt, wird dieses ausschließlich als plattformtechnisches Host Storage geführt und niemals als Business-Storage-Ziel oder Migrationsquelle verwendet.

Der Scheduler verwendet weiterhin `enqueueEnrichment()` und benötigt deshalb keine zweite Queue-Implementierung. Vor Alpha werden Registrierung, Konfiguration und der gemeinsame Producer-Pfad getestet. Der einzige live ausgeführte Scheduler-Smoke findet erst nach Y1-Decommission und Flex-Timer-Aktivierung statt, damit nicht zwei Timer-Ausführungen für dieselbe Umgebung entstehen.

### IaC and release contract

Die Flex-Komposition referenziert die jeweils vorhandenen Environment-Datenquellen und erzeugt nur die für Flex-Hosting erforderlichen Ressourcen. WP-IR01 prüft dafür nur Resource-Modell, Naming, Scope und What-if-Allowlist. WP-IR02 modelliert und WP-IR03 provisioniert die neue dedizierte Flex-Application-Insights-Instanz sowie das vertraglich erforderliche plattformtechnische Host-/Deployment-Storage; deren vorheriges Fehlen ist kein Preflight-Fehler. `what-if` darf keine Shared-Ressourcen, keine bestehenden Cosmos-/Business-Storage-Ressourcen, Queues oder Blob-Container und keine unerwarteten Y1-Änderungen zeigen. Blob-Daten-Plane-Listing ist kein What-if- oder Preflight-Bestandteil. Host-Storage, Business Storage und beide Telemetrieflächen werden nach Provisionierung anhand von Setting-Namen, Resource-IDs und Environment-Zuordnung nachgewiesen. Das erwartete `what-if` darf keinen Queue-Wechsel, Blob-Datenumzug, Blob-Mutation oder Ersatz bestehender Business-Storage-Ressourcen ausweisen; jede tatsächliche Anzeige einer solchen Mutation ist STOP.

Der Backend-Artefaktpfad bleibt clean-build-basiert. `backend/dist` wird frisch erzeugt, der Renderer-Asset-Mirror wird verifiziert, `_deploy_staging/dist` wird gespiegelt und das für Flex bestätigte Package-Deployment verwendet. Der Deploy nach Alpha verwendet denselben bereits geprüften Artefakt-Hash wie DEV. Nach dem Artefakt-Deploy wird das konfigurierte `preview-flex`-Profil zwingend als neuer EAS-Build erstellt; die Build-ID und die eingebettete Flex-URL sind Handoff-Voraussetzung für den fokussierten Alpha-Smoke.

### Recovery

Vor jeder mutierenden Phase werden der letzte funktionierende Git-Commit, das zugehörige Backend-Artefakt, die IaC-Version und die Environment-Parameter als Release-Referenz festgehalten. Schlägt DEV oder der Alpha-Smoke fehl, bleibt Y1 unangetastet und die Ausführung stoppt. Nach dem Decommission gibt es keinen laufenden Legacy-Rückfallbetrieb; eine Wiederherstellung erfolgt bei Bedarf durch erneutes Bauen und Provisionieren aus diesen versionierten Eingaben. Shared Datenressourcen, bestehendes Business Storage, Queues, Blob-Container und Blob-Daten werden nicht zurückgesetzt, verschoben, ersetzt oder migriert. Die erforderliche separate Flex-Telemetrie wird nicht gelöscht oder ersetzt.

### Phase-specific permission matrix

Diese Matrix ist normativ. Sie unterscheidet die zulässige RG-scoped-`Contributor`-Basis im No-Role-Assignment-Fall von der abgelehnten Subscription-scoped-`Contributor`-Identität. Wenn die IaC Role Assignments erstellt, ergänzt sie ausschließlich die targeted Permission(s) für die allowlisteten Assignments an deren engsten erforderlichen Scopes. Jede Zeile verlangt eine eigene phasenbezogene Identitäts- und Scope-Evidence; Owner-Rechte und breite Eskalationen werden in keiner Phase akzeptiert.

| Phase / Nutzung | Erforderliche Identität | Zulässiger Mindest-Scope und Rolle | Zusätzliche Berechtigung | Evidence |
|---|---|---|---|---|
| WP-IR01 read-only | Dedizierte phasenbezogene Read-only-Azure-Identität zur Prüfung der später verwendeten Deployment-Identität | Nur die für Subscription-/RG-/Resource-GETs erforderlichen Read-Rechte; kein Deployment-Role-Binding notwendig | Keine | Tatsächlich verwendete Read-only-Identität, effektiver Scope, Nachweis der tatsächlichen dedizierten Deployment-Identität mit RG-only-Scope und read-only Assignment-Review |
| WP-IR02, WP-IR03, WP-IR04, WP-IR05, WP-IR06 und WP-IR09 Azure-Mutation | Dedizierte Deployment-Identität je Phase | Im No-Role-Assignment-Fall `Contributor` ausschließlich auf der bestehenden Resource Group `rg-Michael-Mueller`; niemals Subscription-scoped `Contributor` und niemals `Owner` | Wenn die geprüfte IaC Role Assignments erstellt: nur die exakt erforderlichen Permission(s), zum Beispiel `Microsoft.Authorization/roleAssignments/write` oder ein engeres Äquivalent, ausschließlich an den jeweils erforderlichen Assignment-Scopes. Wenn die IaC keine Role Assignments erstellt, keine zusätzliche RBAC-Berechtigung verlangen. | Identitätsnachweis, exakter RG-Scope, Rolle, Phase, tatsächliche Nutzung, explizite No-Assignment-Evidence oder vollständige What-if-/Assignment-Allowlist mit Principal, Role, Action und Scope |
| WP-IR04, WP-IR10 Post-Checks und Release | Eigene phasenbezogene Prüf-/Release-Identität | Nur die für GETs, Logs, Release-Evidence und den konkreten Schritt erforderlichen Rechte; ein vorhandener RG-scoped Deployment-Scope darf nicht auf Subscription-Ebene erweitert werden | Keine pauschale RBAC-Erweiterung | Read-/Release-Session, Scope und ausgeführte Aktion |
| WP-M01 und WP-IR07 EAS | Phasenbezogene EAS-/Build-Identität | Nur EAS-Profil-/Build-Rechte im EAS-Scope; keine Azure-Subscription-Rolle aus dem Build ableiten | Keine Azure-RBAC-Rechte, sofern der Build sie nicht konkret benötigt | EAS-Berechtigungsnachweis ohne Tokens, Profil, Build-ID und Zeitpunkt |

Eine nicht lesbare oder nicht eindeutig zuordenbare Matrix, eine nicht read-only bestätigbare Assignment-Permission oder ein nicht bestätigbarer Assignment-Scope ist `UNVERIFIED-PERMISSIONS` plus `STOP`; eine Subscription-scoped-`Contributor`-, Owner- oder sonst zu breite Identität ist `PLAN-ASSUMPTION-INVALID:WA-15`. Die Matrix verlangt keine zusätzlichen RBAC-Rechte allein deshalb, weil ein Resource- oder Managed-Identity-Modell beschrieben ist; sie verlangt targeted Permission(s) nur für nachgewiesene, allowlistete Role Assignments. Der Executor darf keine Azure-RBAC-Reparatur selbst ausführen.

### Deterministic Agent Contract

Die folgende Matrix ist für die Ausführung normativ und ergänzt die Detailbeschreibungen der Work Packages. Jeder Schritt hat genau einen Owner. `PASS` ist der einzige erfolgreiche Handoff; `STOP` beendet die Sequenz vor der nächsten Mutation; ein blockierendes `UNVERIFIED` ist niemals ein erfolgreicher Handoff. Der WP-IR01-`PASS` darf die nicht blockierenden Statuswerte `UNVERIFIED-QUOTA` beziehungsweise den historischen, nicht erforderlichen `UNVERIFIED-BLOB-DATA-READER` ausdrücklich vermerken. Die Detail-WPs müssen mindestens die hier genannten Inputs und Checks belegen.

| WP | Owner | Konkrete Inputs | Konkrete Prüfung | Erwarteter Handoff | Resultat |
|---|---|---|---|---|---|
| WP-B01 | Backend | WP-IR01-`PASS`; Root-/Backend-/Staging-Manifeste, Lockfiles, Queue-Producer, Queue-Trigger, Storage-Helper und lokale Setting-Vorlage | Node-24-Manifeste konsistent; Producer liest ausschließlich `STORAGE_CONNECTION_STRING`; Trigger nutzt dieselbe Setting und `reusable-items-enrich`; Tests zeigen keinen Host-Storage-Fallback; API, Cosmos und Persistenz unverändert | Geänderte Backend-/Manifest-Dateien, Queue-Testnachweis, redigierte Setting-Matrix und Storage-Invarianten | `PASS` bei vollständigem Code-/Test-Handoff; `STOP` bei Fallback, Vertragsabweichung oder Annahmenfehler; `UNVERIFIED` bei fehlendem Repository-/Preflight-Nachweis |
| WP-B02 | Backend | WP-B01-`PASS`, WP-IR02-`PASS`, lokale Node-24-Umgebung, lokale Settings, Workspace-Abhängigkeiten | Clean Build, Typechecks, Vitest, `build:verify`, Asset-Mirror, Linux-x64-Native-Gate sowie exakter Startup-Gate `npm run dev` aus `backend/` mit Health 200 und sauberer Beendigung | Frisches `_deploy_staging`-Artefakt, Manifest/Content-Hash, Testresultate und secretfreie Gate-Evidence | `PASS` bei allen Gates; `STOP` bei Fehler, Secret-/Encoding-Verstoß oder fehlender sauberer Beendigung; `UNVERIFIED` bei fehlender lokaler Voraussetzung |
| WP-IR01 | Infrastructure | WA-15-Evidence; diese Planversion nach neuer `APPROVE`; phasenbezogene Azure-Read-only-Session; bestehende Resource-/Storage-/Cosmos-IDs; Bicep-Kontext | Read-only Region/RG/Provider/API/FC1/Node24/v4, WA-01 bis WA-12 und WA-15, tatsächliche dedizierte Deployment-Identität mit RG-only-Scope, Review ob die geplante IaC Role Assignments erstellt, dokumentierte Standard-Quota-Basis, Host-Storage-Modell, Telemetrie-Contract, Package-Deploy-Weg, Control-Plane-Storage-Referenzen und What-if-Allowlist prüfen; keine Blob-Dateninventur und keinerlei Mutation | Vollständige Scope-/Schema-/Quota-Basis-/Storage-/Permission-Matrix, explizite No-Assignment-Evidence oder Assignment-Allowlist mit Permission(s)/Principal/Role/Scope, Codes und Nachweis `Mutation: NO`; subscription-spezifische Quota-Messung darf als `UNVERIFIED-QUOTA` nicht blockierend vermerkt werden | `PASS` bei vollständiger Bestätigung der blockierenden Verträge, auch mit nicht blockierender `UNVERIFIED-QUOTA`-Annotation; `STOP` bei bekannter Abweichung, WA-15-Verstoß, nicht bestätigbarer Assignment-Permission/-Scope oder Business-Storage-Mutation; `UNVERIFIED` nur bei fehlender blockierender Evidence, wobei `UNVERIFIED-PERMISSIONS`/`STOP` kein Folge-WP entsperrt |
| WP-IR02 | Infrastructure | WP-IR01-`PASS`, WP-B01-Queue-Vertrag, `infra/`, DEV-/Alpha-Parameter, bestätigte API-/Property-Pfade | Bicep-/Parameter-Vorbereitung, `az bicep build`/Lint, Setting- und Identity-Matrix, dedizierte Flex-Telemetrie, vertragliches Host-/Deployment-Storage und `what-if` gegen die Allowlist; Business Storage nur referenzieren | Reviewbare Flex-IaC für DEV/Alpha, Parameter, Resource-/Setting-Matrix und erlaubter Releasepfad | `PASS` bei reviewbarer, allowlist-konformer IaC; `STOP` bei falschem API-/Scope-/Setting-/What-if-Befund; `UNVERIFIED` bei unvollständigem Contract-Handoff |
| WP-IR03 | Infrastructure | WP-IR02-`PASS`, WP-B02-`PASS`, DEV-Parameter, zulässige phasenbezogene Azure-Berechtigung | Vorab-`what-if`, Allowlist-Vergleich, danach `az deployment group create` für DEV; Post-GET für FC1, Node24/v4, `0`, `5`, App Settings, Host-/Business-Storage, Cosmos und eigene Flex-Telemetrie; Post-Provisioning-Quota-Kontrolle mit dokumentierter Standardbasis, Quelle und Zeitpunkt | DEV-Resource-IDs/Hostname, Post-GETs, Quota-Kontroll-Evidence, Telemetrie-/Storage-Evidence und Artefaktziel | `PASS` bei vollständiger DEV-Baseline und nachgewiesener Workload-Unterstützung; `STOP` bei unerwarteter Mutation, Business-Storage-Mutation, `STOP-FLEX-QUOTA-INSUFFICIENT` oder `STOP-FLEX-QUOTA-BASIS-CONTRADICTED`; `UNVERIFIED` bei nicht lesbarer erforderlicher Post-Evidence |
| WP-IR04 | Infrastructure | WP-IR03-`PASS`, WP-B02-Artefakt/Hash, DEV-Flex-App und kontrollierter CIAM-Testuser | DEV-Deploy aus `_deploy_staging/` mit Remote-Linux-Buildweg, Function List, Health 200, Auth-401, CIAM, reversible API-/Blob-/AI-/DI-/Renderer-Flows, Queue-Setting, Telemetrie, Post-Provisioning-Quota-Kontrolle und Control-Plane-Storage-Schutz prüfen | Vollständige DEV-Evidence mit eindeutigem `DEV-GATE: PASS` oder STOP; kein Alpha-Handoff bei STOP/UNVERIFIED | `PASS` nur bei vollständigem Gate; `STOP` bei jedem technischen, Quota- oder Schutzfehler; `UNVERIFIED` bei fehlender erforderlicher Evidence |
| WP-IR05 | Infrastructure | WP-IR04-`DEV-GATE: PASS`, WP-IR02-IaC, Alpha-Parameter, Alpha-Resource-IDs und WA-13-Schutzliste | Alpha-`what-if`, Provisionierung und Post-GET; Alpha-Cosmos/Business Storage, Host Storage, `0`, `5`, separate Telemetrie und unveränderter Y1-Schutz prüfen; Post-Provisioning-Quota-Kontrolle mit dokumentierter Standardbasis, Quelle und Zeitpunkt; Hintergrundfunktionen noch nicht live | Alpha-Flex-IDs/Hostname, Resource-/Setting-/Telemetry-Evidence, Quota-Kontroll-Evidence und Y1-Schutz-Handoff | `PASS` bei vollständiger Alpha-Baseline und nachgewiesener Workload-Unterstützung; `STOP` bei Schutz-/What-if-/Annahmenfehler, Business-Storage-Mutation oder WA-06-Quota-STOP; `UNVERIFIED` bei fehlender erforderlicher Resource-/Quota-/Telemetry-Evidence |
| WP-IR06 | Infrastructure | WP-IR05-`PASS`, WP-B02-geprüftes Artefakt und DEV-Hash, `_deploy_staging/` | Alpha-Deploy ohne Neubau aus demselben staging Artefakt; Hash bytegenau vergleichen und Function List/Runtime/Settings prüfen | Alpha-Deploy-Nachweis mit identischem Hash, Runtime und Environment-Matrix | `PASS` bei identischem Hash und vollständigem Deploy-Nachweis; `STOP` bei Hash-/Environment-/Storage-Abweichung; `UNVERIFIED` bei fehlendem Vergleich |
| WP-M01 | Frontend | WP-IR05-Alpha-Flex-Hostname, bestehendes `mobile/eas.json`, Client-/Auth-Kontext | Genau ein `preview-flex`-Profil mit direkter URL plus `/api`; öffentliche Werte unverändert; kein Native-/Plugin-/App-Config-/Screen-/Navigation-Diff | Statischer Config-Handoff an WP-IR07 mit URL und erwarteter Build-Konfiguration | `PASS` bei exakt einem validierten Profil; `STOP` bei falscher URL, Secret oder zusätzlichem Scope; `UNVERIFIED` bei fehlendem Hostname |
| WP-IR07 | Infrastructure | WP-M01-`PASS`, WP-IR06-`PASS`, EAS-Zugriff, Alpha-Flex-URL | Installierbaren neuen `preview-flex`-EAS-Build erstellen; Build-ID, eingebettete URL, öffentliche CIAM-/Variant-/Package-Werte und fehlende Native-Änderung prüfen | Build-ID und installierbares Artefakt als zwingender Input für WP-IR08 | `PASS` nur mit Build-ID und URL-Evidence; `STOP` bei Build-/Config-/Secretfehler; `UNVERIFIED` bei nicht prüfbarer Einbettung |
| WP-IR08 | Infrastructure | WP-IR06- und WP-IR07-`PASS`, Build-ID, Alpha-Flex-Endpoint, CIAM-Testuser und Testdaten | Direkter Client-Smoke, Health 200, Auth-401, Login/Refresh, reversible Daten-/Blob-/AI-/DI-/Renderer-Flows, Hash, Telemetrie und No-Migration-Schutz prüfen; Queue/Timer noch nicht live | Fokussierter Alpha-Smoke mit eindeutigem `PASS` oder STOP; Y1 bleibt bei STOP erhalten | `PASS` bei vollständigem Smoke; `STOP` bei Vertrags-, Daten-, Auth-, Telemetrie- oder Clientfehler; `UNVERIFIED` bei fehlendem Build/User/Evidence |
| WP-IR09 | Infrastructure | WP-IR08-`PASS`, Y1-/Flex-Resource-IDs, Decommission-Allowlist, Recovery-Referenzen | Letztes Y1-`what-if`, gezieltes Decommission ausschließlich des erlaubten Host-Scope; erst danach Flex-Queue/Timer aktivieren und je einen kontrollierten Queue-/Timer-Smoke ausführen | Decommission-Post-GETs, exakt einmalige Queue-/Timer-Evidence, Schutz- und Recovery-Nachweis | `PASS` bei erlaubtem Scope und genau einmaliger Verarbeitung; `STOP` vor Mutation bei unklarem Scope/Smoke; `UNVERIFIED` bei fehlendem Post-Check |
| WP-IR10 | Infrastructure | WP-IR09-`PASS`, alle Evidence, Hashes, Build-ID, IaC-/Parameter-/Recovery-Referenzen | Release-Record und betroffene Infrastruktur-Dokumentation auf Vollständigkeit, tatsächlichen Zielwert `0`/`5`, Scope, DEV-/Alpha-Quota-Kontrollen, Telemetrie, Control-Plane-Storage-No-Migration, Hash und Secretfreiheit prüfen | Reproduzierbarer, secretfreier Release-Handoff an QA | `PASS` bei vollständiger Dokumentation; `STOP` bei Widerspruch, Quota-STOP, Business-Storage-Mutation oder Secret; `UNVERIFIED` bei nicht belegbarem ausgeführten Zustand |
| WP-QA-Final | QA | WP-IR10-`PASS`, vollständiger AC-Satz, alle Handoffs, Release-Record und `DEV-GATE` | Jede AC genau einmal gegen Evidence prüfen; `UNVERIFIED`/`MANUAL VALIDATION REQUIRED` getrennt ausweisen; keine Implementierungs- oder Mutationsentscheidung treffen | Ein QA-Bericht mit genau einem Verdict `PASS`, `PASS WITH ISSUES` oder `FAIL` | `PASS`/`PASS WITH ISSUES`/`FAIL`; fehlende Evidence darf niemals als PASS gewertet werden |

## 11. Backend Work Package

### WP-B01 Backend- und Queue-Vorbereitung

**Agent:** Backend

**Status:** Blocked — pending WA-15 identity/scope evidence, a fresh read-only WP-IR01 `PASS`, and the new approval lifecycle. This revision performs no Backend mutation.

**Goal:** Node-24-Kompatibilität vorbereiten und die Business-Queue-Zuordnung ohne API- oder Persistenzänderung explizit machen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `package.json`
- `package-lock.json`
- `backend/package.json`
- `_deploy_staging/package.json`
- `backend/src/lib/queueClient.ts`
- `backend/src/lib/storage.ts`
- `backend/src/functions/reusableItems.ts`
- `backend/src/functions/reusableItemsEnrich.ts`
- `backend/src/functions/reusableItemsEnrichScheduler.ts`
- `backend/src/lib/registrations.test.ts`
- `backend/local.settings.json.template`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-2
- AC-3
- AC-4
- AC-5

**Dependencies:**
- WP-IR01 read-only Preflight `PASS` with `SUPPORTED` result for `maximumInstanceCount = 5`;
- the explicit `Always Ready = 0: SUPPORTED` result from the fresh WP-IR01 handoff;
- resolved `WA-15` under the conditional RG-scoped `Contributor`/Role-Assignment contract and a fresh WP-IR01 `PASS` under the revised semantics; `UNVERIFIED-QUOTA` is non-blocking preflight evidence and `UNVERIFIED-BLOB-DATA-READER` is not required.

**Result:** `PASS`, wenn Manifest-/Queue-Vertrag und die zugehörigen Tests vollständig übergeben sind und kein Gate umgangen wurde; `STOP`, wenn der Preflight-Handoff, die Zielwerte oder die gewünschte Setting-Zuordnung widersprüchlich sind; `UNVERIFIED`, wenn ein erforderlicher Repository-Nachweis nicht gelesen werden kann. Nur `PASS` entsperrt WP-IR02.

**Expected Handoff:**
- Node-24-kompatible Manifest-/Lockfile-Anpassungen ohne unbegründete Dependency-Upgrades;
- Queue-Änderung, bei der Producer und Trigger ausschließlich `STORAGE_CONNECTION_STRING` verwenden;
- aktualisierte Unit-/Registration-Testfälle für die fehlende Host-Storage-Auswahl;
- redigierte Setting-Matrix ohne Secretwerte und Bestätigung, dass API, Cosmos und Dokumentmodell unverändert bleiben;
- Bestätigung, dass bestehende DEV-/Alpha-Business-Storage-Ressourcen, Queues, Blob-Container und Blob-Daten unverändert weiterverwendet werden und keine Storage-Migration oder Datenverschiebung vorgesehen ist.

### WP-B02 Clean Build und Tests

**Agent:** Backend

**Status:** Blocked — pending WP-B01 and WP-IR02 `PASS` under the confirmed target-value contract. No build or local startup gate is executed in this revision.

**Goal:** Den vorbereiteten Stand mit frischem Build, Tests, Build-Verify und dem verpflichtenden lokalen Startup-/Smoke-Gate als deploybaren Artefaktkandidaten übergeben.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `package-lock.json`
- `backend/package.json`
- `backend/scripts/dev.mjs`
- `backend/scripts/storage.mjs`
- `backend/README.md`
- `backend/local.settings.json`
- `backend/local.settings.json.template`
- `.gitignore`
- `backend/tsconfig.json`
- `backend/scripts/verify-build.mjs`
- `backend/scripts/copy-instagram-assets.mjs`
- `backend/src/`
- `shared/`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-3
- AC-5

**Dependencies:**
- WP-B01 `PASS`;
- WP-IR02 IaC-/Build-Vorbereitung with the confirmed `5` contract;
- no unresolved blocking preflight gate.

**Result:** `PASS`, wenn alle deklarierten Build-, Test-, Asset-, Hash- und lokalen Startup-Gates bestanden sind; `STOP` bei einem fehlgeschlagenen Gate oder Secret-/Encoding-Verstoß; `UNVERIFIED` bei fehlender lokaler Voraussetzung oder nicht reproduzierbarem Evidence. Nur `PASS` entsperrt WP-IR03.

**Expected Handoff:**
- Ergebnisse der betroffenen Typechecks und Vitest-Suites;
- erfolgreicher `build:verify`-Lauf;
- verpflichtender lokaler Startup-/Smoke-Gate nach dem finalen Manifest-/Lockfile- und Backend-Stand: aus `backend/` exakt `npm run dev`, Build erfolgreich, Azurite Blob-/Queue-/Table-Dienste HTTP-ready, Queue `reusable-items-enrich` vorhanden, Functions-Host auf Port 7071, `GET http://localhost:7071/api/health` HTTP 200, danach kontrollierte saubere Beendigung ohne zurückgelassene von `dev.mjs` gestartete Prozesse; bei Fehlern eine phasengenaue Diagnose;
- Nachweis, dass der Gate nur lokale `local.settings.json`-/Azurite-/Emulator-Konfigurationen verwendet, keine Flex-Host-Storage-Einstellung voraussetzt, keine Azure-Ressource verändert und alle Evidence secretfrei bleibt;
- frischer Backend-Build mit vollständigem Renderer-Asset-Manifest;
- Artefaktmanifest und Content-Hash als Input für DEV und Alpha;
- dokumentierte Encoding- und Secret-Leak-Prüfung ohne Secretwerte.

## 12. Infrastructure & Release Work Packages

### WP-IR01 Read-only Flex-/Runtime-/Package-Preflight

**Agent:** Infrastructure

**Status:** Blocked — pending WA-15 identity/scope and conditional Role Assignment capability evidence and a new explicit `APPROVE`; after that approval this WP is the only permitted first step and remains read-only. No Azure mutation, code/IaC/mobile edit, EAS or deployment step is permitted here. Subscription-specific quota evidence and Blob Data Reader evidence are not prerequisites. All later WPs remain blocked until a fresh `PASS` under the revised semantics.

**Goal:** Nach WA-15-Evidence und neuer `APPROVE` den Azure-, Flex-Betriebs-, dokumentierten Standard-Quota-, Storage- und Release-Vertrag erneut ausschließlich read-only belegen. Dabei werden die bereits bestätigten Befunde `maximumInstanceCount = 5: SUPPORTED` und `Always Ready = 0: SUPPORTED` auf Drift geprüft, die tatsächliche dedizierte Deployment-Identität mit RG-only-Scope bestätigt und die spätere Resource-Komposition einschließlich der Frage nach neuen Role Assignments gegen Control-Plane-Referenzen und What-if-Allowlist geprüft. Wenn keine Role Assignments geplant sind, wird RG-scoped `Contributor` als Basis bestätigt; wenn Assignments geplant sind, werden nur die exakt erforderlichen Permission(s), Scopes und die Assignment-Allowlist bestätigt. Eine subscription-spezifische Quota-Messung und Blob-Dateninventur sind in diesem Preflight nicht erforderlich; keine zukünftige Resource-ID für Flex-Application-Insights oder Host-/Deployment-Storage wird vorausgesetzt.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- `infra/main.bicep`
- `infra/modules/functionapp.bicep`
- `infra/modules/storage.bicep`
- `infra/modules/appinsights.bicep`
- `infra/parameters/dev.bicepparam`
- `infra/parameters/alpha.bicepparam`
- `_deploy_staging/package.json`
- `mobile/eas.json`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-1
- AC-2
- AC-4
- AC-6
- AC-17

**Dependencies:**
- Externe WA-15-Auflösung durch den Subscription-/Cloud-Owner: tatsächliche dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller`, Rollen-/Scope-Matrix und read-only Assignment-Review; bei geplanten Role Assignments zusätzlich die exakt erforderlichen Permission(s), Scopes und Assignment-Allowlist;
- neue explizite Benutzerfreigabe `APPROVE` für diese Planrevision.

**Responsible Owner:** Infrastructure & Release führt den erneuten read-only Preflight aus und prüft die Evidence. Der Subscription-/Cloud-Owner löst nur `WA-15` auf, indem er die tatsächliche dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller`, die Matrix und die read-only Assignment-Prüfung bereitstellt. Bei keinen Role Assignments genügt die RG-scoped-`Contributor`-Basis; bei Assignments müssen die exakt erforderlichen Permission(s), Scopes und die Assignment-Allowlist vorliegen. Subscription-spezifische Quota-Evidence und Blob-Data-Reader-Evidence werden nicht von externen Ownern verlangt. EAS-Berechtigung wird erst im EAS-WP geprüft. Infrastructure darf keine Owner- oder Subscription-Contributor-Eskalation, Provider-Registrierung, Quota-Erhöhung, Ressourcenmutation oder RBAC-Selbstreparatur als Ersatz vornehmen.

**Result:**
- `PASS`: Alle blockierenden Contract-, Permission-, Scope-, Package- und What-if-Allowlist-Nachweise sind vollständig, aktuell und secretfrei; die tatsächliche phasenbezogene Deployment-Identität erfüllt `WA-15` mit `Contributor` ausschließlich auf `rg-Michael-Mueller`, und die read-only Assignment-Prüfung zeigt entweder keine geplanten Role Assignments oder die exakt erforderlichen Permission(s), Scopes und die vollständige Assignment-Allowlist. `maximumInstanceCount = 5` bleibt im exakten Flex-Scope `SUPPORTED`; `Always Ready = 0` bleibt explizit abbildbar; die dokumentierte Standard-Flex-Quota ist als Arbeitsbasis festgehalten; WP-B01 darf starten. Eine fehlende subscription-spezifische Messung darf als nicht blockierendes `UNVERIFIED-QUOTA` vermerkt werden. Eine Blob-Inventur und `Storage Blob Data Reader` sind kein Bestandteil des Handoffs.
- `STOP`: Eine bekannte technische Inkompatibilität, eine Sicherheitsverletzung oder ein unzulässiger What-if-Befund liegt vor. Bei bestätigter Ablehnung von `5` lautet der Wert-Gate-Code `PLAN-ASSUMPTION-INVALID:WA-04` plus `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED`; bei bestätigter Nichtunterstützung der expliziten Darstellung von `0` lautet er `PLAN-ASSUMPTION-INVALID:WA-05` plus `STOP-AR0-UNSUPPORTED`. Der Orchestrator startet kein mutierendes Folge-WP und ruft den Planner gemäß Protocol auf.
- `UNVERIFIED`: Ein für WP-IR01 blockierender read-only Nachweis ist wegen fehlendem Zugriff oder nicht verfügbarer, unterstützter Evidence nicht entscheidbar. `UNVERIFIED-PERMISSIONS` für eine nicht bestätigbare Assignment-Permission/-Scope-Kombination wird ausdrücklich zusammen mit `STOP` gemeldet; `UNVERIFIED-MAXIMUM-INSTANCE-SCOPE` und `UNVERIFIED-AR0-EXPLICIT` sind ebenfalls kein GO und werden ohne Ersatzwert gemeldet. `UNVERIFIED-QUOTA` ist im Preflight dagegen eine zulässige nicht blockierende Mess-Evidence; `UNVERIFIED-BLOB-DATA-READER` ist historisch und nicht erforderlich. Eine spätere Quota-Nichtunterstützung wird nicht als bloßes `UNVERIFIED-QUOTA` behandelt, sondern mit dem präzisen WA-06-STOP-Code.

**Read-only Checks:**
1. Subscription, vorhandene Resource Group `rg-Michael-Mueller`, `northeurope`, `Microsoft.Web`, Flex-SKU/API, Node 24 LTS und Functions v4 mit Azure-CLI-/ARM-/Portal-Lesezugriff bestätigen. `Microsoft.Quota` darf nicht registriert werden.
2. Die dokumentierte Standard-Flex-Quota und ihren Geltungsbereich als Arbeitsbasis für den kleinen DEV-/Alpha-Workload festhalten. Eine subscription-spezifische Flex-Memory-Messung ist in WP-IR01 nicht erforderlich. Falls ein bereits verfügbarer, dokumentierter Read-only-Weg eine Messung liefert, wird sie mit Quelle, Region, Metrik, aktuellem Wert, Limit, Einheit, Scope und Datum unverändert protokolliert; ein fehlender Wert bleibt `UNVERIFIED-QUOTA` ohne Blockade. Ein generischer oder nicht unterstützter Endpoint darf nicht als Beweis erfunden werden. `Microsoft.Quota` wird nicht registriert.
3. Für `Always Ready = 0` die bestehende dreiteilige Matrix erneut gegen die aktuelle Evidence prüfen: dokumentierter Default; bestätigte explizite IaC-/ARM-Darstellung mit API-Version, Property-Pfad und Typ; erwarteter Post-Provisioning-GET-Nachweis für WP-IR03/WP-IR05. Der aktuelle What-if-Befund `http: { instanceCount: 0 }` bleibt `SUPPORTED`; eine spätere Nichtunterstützung ist `STOP-AR0-UNSUPPORTED` plus `PLAN-ASSUMPTION-INVALID:WA-05`.
4. Für `Maximum Instances = 5` die bestehende Scope-/Schema-Matrix erneut gegen Drift prüfen: Ressourcentyp/API-Version, exakter Property-Pfad, Bicep-Parametername und `@minValue(40)`-Constraint, offizielle ARM-/Provider-Schemaaussage, dokumentierter Dienstvertrag, erfolgreicher What-if mit `5` und Scope-Abgrenzung. Der Handoff muss ausdrücklich zwischen Template-Input-Guard und serverseitiger Regel unterscheiden und festhalten, dass es ein Flex-Instance-Limit und kein globales App-, Subscription- oder pauschales Gesamtlimit ist. Der aktuelle Befund bleibt `SUPPORTED`; nur eine spätere autoritative Dienst-/Provider-Ablehnung erzeugt `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED` plus `PLAN-ASSUMPTION-INVALID:WA-04`.
5. Den unterstützten Remote-Oryx-/Package-Deploy für Windows-zu-Linux einschließlich `sharp` und `@resvg/resvg-js` belegen. Der Preflight bestätigt den Weg, deployt aber kein Paket.
6. Das Flex-Resource-Modell, Naming, Scope, Identity/RBAC, App-Settings- und What-if-Allowlist für eine neue Function App, eine neue dedizierte Flex-Application-Insights-Instanz und das vertraglich erforderliche Host-/Deployment-Storage prüfen. Dabei die geplante IaC read-only auf Role Assignments prüfen: Wenn keine erstellt werden, die explizite No-Assignment-Evidence dokumentieren; wenn welche erstellt werden, jeden Assignment-Principal, jede Rolle, jede Permission/Action und jeden erforderlichen Scope in einer Allowlist erfassen und die Fähigkeit zum Erstellen genau dieser Assignments bestätigen. Dafür ist eine vom Provider unterstützte read-only Schema-/What-if-Prüfung gegen einen nicht persistierten Draft zulässig; `az deployment group create` ist in WP-IR01 verboten. Erwartet werden ausschließlich Creates der neuen Flex-Ressourcen und nur die ausdrücklich allowlisteten Role Assignments. Das Nichtvorhandensein dieser zukünftigen Ressourcen ist erwarteter Ausgangszustand und kein STOP.
7. Bestehende DEV-/Alpha-Cosmos-, Business-Storage-, Queue- und Container-Resource-IDs read-only erfassen. Für Business Storage nur Control-Plane-Settings, Queue-/Container-Referenzen, What-if-Allowlist und No-Mutation-Schutz prüfen. Keine Blob-Datenliste, kein Digest und kein `Storage Blob Data Reader`-Nachweis wird versucht oder verlangt; der historische `UNVERIFIED-BLOB-DATA-READER` bleibt reine Handoff-Dokumentation.
8. Die tatsächliche dedizierte Azure-Deployment-Identität, ihren `Contributor`-Scope ausschließlich auf `rg-Michael-Mueller` und die phasenbezogenen Rollen gegen `WA-15` prüfen. Die geplante IaC read-only auf neue Role Assignments prüfen. Ohne Role Assignments ist RG-scoped `Contributor` zulässig; bei Role Assignments sind nur die exakt erforderlichen Permission(s), die engsten erforderlichen Scopes und die Assignment-Allowlist zulässig. Die aktuelle Subscription-`Contributor`-Identität, jede Owner-Rolle, breite Eskalation oder nicht read-only bestätigbare Assignment-Permission/-Scope ist unzulässig beziehungsweise `UNVERIFIED-PERMISSIONS`/`STOP`; der Executor darf keine RBAC-Reparatur ausführen. Die spätere EAS-Identität wird in WP-IR07 geprüft.
9. Den aktuellen Queue-Fallback und die Y1-Node-Drift als bekannte Vorbereitungsarbeit an WP-B01 übergeben. Sie sind kein Grund, den read-only Contract-Gate mit einer bereits implementierten Queue-Korrektur zu vermischen.

**Expected Handoff:**
- read-only Subscription-/Region-/Provider-/Flex-/Node-/Functions-v4-Evidence;
- Quota-Basis-Evidence mit dokumentierter Quelle und Geltungsbereich; kein behaupteter präziser subscription-spezifischer Wert. Eine fehlende Messung wird als nicht blockierendes `UNVERIFIED-QUOTA` vermerkt; die verpflichtende Workload-Unterstützung wird erst in WP-IR03/WP-IR05 evidenceiert;
- dreiteilige `Always Ready = 0`-Matrix (Default, explizite IaC-/ARM-Darstellung, späterer Post-Provisioning-Nachweis) mit dem aktuellen `SUPPORTED`-Befund und späterem GET;
- Scope-/Schema-Matrix für `Maximum Instances = 5` mit API-Version, Property-Pfad, Template-Constraint, Provider-/Dienst-Evidence, erfolgreicher What-if-Validierung, Ergebnis `SUPPORTED` und Scope-Abgrenzung; keine Ersetzung durch `40`;
- phasenbezogene Azure-Permission-/Scope-Matrix mit Nachweis der tatsächlich verwendeten Deployment-Identität, RG-only-Scope, No-Assignment-Evidence oder vollständiger Assignment-Allowlist und ohne Owner-/Subscription-Contributor-Eskalation; die EAS-Matrix wird im späteren EAS-WP evidenceiert;
- bestätigter Remote-Oryx-/Package-Deployment-Weg für Linux-native Module;
- Resource-Modell-, Naming-, Identity/RBAC- und What-if-Allowlist für die später zu erzeugenden Flex-Ressourcen, ohne vorausgesetzte zukünftige Resource-IDs;
- Host-/Business-Storage-Matrix je Environment mit vorhandenen Business-Storage-Resource-IDs, Queue- und Container-Referenzen, Settings, What-if-Allowlist und No-Mutation-Evidence; keine Blob-Dateninventur oder Data-Reader-Evidence;
- Permission-/Scope-Evidence für `WA-15` und eindeutiger `PASS`, `STOP` oder `UNVERIFIED`-Befund mit Code;
- Nachweis, dass keine Azure-Ressource verändert wurde.

**Ausgeführter WP-IR01-Read-only-Handoff vom 2026-09-29 (historischer Ausführungsstand; `STOP`, keine Freigabe):**

**Result:** `STOP`

**Codes:** `PLAN-ASSUMPTION-INVALID:WA-15`, `UNVERIFIED-QUOTA`, `UNVERIFIED-BLOB-DATA-READER`

**Mutation status:** `NO`

**Blocked:** `WP-B01` und alle Folge-WPs

**Azure evidence:**

- Subscription `Microsoft Azure Sponsorship 26/27-1`, Resource Group `rg-Michael-Mueller`, Region `northeurope`, Status `Succeeded`.
- `Microsoft.Web`: `Registered`.
- `Microsoft.Quota`: `NotRegistered`; keine Registrierung ausgeführt.
- Flex Consumption unterstützt `northeurope`.
- Linux Runtime listet Node 24 mit Functions Runtime v4.
- Bestehende Y1-Apps: DEV `Node|20`, Alpha `Node|22`; unverändert.
- Ausführende CLI-Identität: `Contributor` auf Subscription-Scope. Unter der revidierten Policy wäre eine dedizierte `Contributor`-Identität ausschließlich auf `rg-Michael-Mueller` zulässig gewesen; der tatsächlich verwendete Subscription-Scope bleibt ein bestätigter `WA-15`-Verstoß. Die Identität darf nicht erneut verwendet werden.

**Scale contract:** `maximumInstanceCount = 5`: `SUPPORTED`.

| Ebene | Evidence |
|---|---|
| Resource/API | `Microsoft.Web/sites@2024-04-01` |
| Property | `properties.functionAppConfig.scaleAndConcurrency.maximumInstanceCount` |
| ARM-Schema | Typ `int` |
| Microsoft Quickstart | Bicep-Parameter `maximumInstanceCount` mit `@minValue(40)` und `@maxValue(1000)` |
| Abgrenzung | `@minValue(40)` ist nur ein Template-Input-Guard, keine bestätigte Provider-Ablehnung |
| Read-only-Validierung | ARM What-if mit `5` erfolgreich; ausschließlich erwartete Creates für Draft-FC1-Plan und Draft-Flex-App, keine Fehler |
| Scope | Flex-App-On-Demand-Instance-Ceiling, kein globales App-, Subscription- oder Gesamtlimit |

Es wurde kein Ersatzwert `40` verwendet. `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED` ist nicht ausgelöst.

**Always Ready matrix:**

| Feld | Befund |
|---|---|
| Dokumentierter Default | `0` laut Microsoft Flex-Dokumentation |
| Explizite Darstellung | `properties.functionAppConfig.scaleAndConcurrency.alwaysReady[]`, Element `{ name: string, instanceCount: int }` in `sites@2024-04-01` |
| Read-only-Validierung | What-if mit `http: { instanceCount: 0 }` erfolgreich |
| Ergebnis | Explizites `Always Ready = 0`: `SUPPORTED` |
| Späterer GET | WP-IR03/WP-IR05: `GET Microsoft.Web/sites@2024-04-01`, Pfad `properties.functionAppConfig.scaleAndConcurrency.alwaysReady` |

`STOP-AR0-UNSUPPORTED` und `UNVERIFIED-AR0-EXPLICIT` sind nicht ausgelöst.

**Quota:** Quelle `Microsoft.Web/locations/northeurope/usages?api-version=2026-08-01`; Zeitpunkt `2026-09-29T08:07:32.984Z`. Die Abfrage lieferte nur klassische VM-Metriken, beispielsweise `Total Regional VMs: current 0, limit 30, unit Instances`, aber keine Flex-Memory-Metrik mit Current, Limit und Einheit. Historisches Ergebnis: `UNVERIFIED-QUOTA`. Die klassische VM-Metrik wurde nicht als Ersatz verwendet. Unter der revidierten Policy bleibt dieser Messbefund nicht blockierend; die dokumentierte Standard-Flex-Quota ist die Arbeitsbasis für den kleinen Workload. WP-IR03 und WP-IR05 kontrollieren nach Provisionierung die tatsächliche Unterstützung, ohne einen präzisen aktuellen Flex-Memory-Wert zu behaupten.

**Storage matrix:**

| Environment | Cosmos | Business Storage | Queue / Container |
|---|---|---|---|
| DEV | `cosmos-fittrack-dev-ppf5sc`, DB `fittrack-db` | `stfittrackdevppf5sc` | `reusable-items-enrich`, `recipe-images`, `label-scans` |
| Alpha | `cosmos-fittrack-alpha-ppf5sc`, DB `fittrack-db` | `stfittrackalphappf5sc` | `reusable-items-enrich`, `recipe-images`, `label-scans` |

Die vollständigen ARM-IDs wurden read-only gelesen. Zusätzlich vorhandene Plattformcontainer umfassen `azure-webjobs-hosts`, `azure-webjobs-secrets`, `function-releases` und `scm-releases`.

Blob-Listing mit Entra Login wurde für beide Business-Storages und beide Business-Container versucht. Die Data-Plane-Berechtigung fehlte; vorhanden war nur eine geerbte `Storage Blob Data Contributor`-Zuweisung für eine andere Service Principal. Historisches Ergebnis: `UNVERIFIED-BLOB-DATA-READER`. Das beweist keine fehlenden Daten. Unter der revidierten Policy ist eine Blob-Inventur oder `Storage Blob Data Reader`-Auflösung für diese Migration nicht erforderlich; Control-Plane-Referenzen, What-if-Allowlist und No-Mutation-Evidence bleiben verbindlich.

**Flex resource contract:** Repository-Baseline: `infra/main.bicep`, `infra/modules/functionapp.bicep`, `infra/modules/storage.bicep`, `infra/modules/appinsights.bicep`.

Zulässige spätere What-if-Creates:

- neuer `FC1`-Plan und neue Linux-Flex-Function-App;
- neue dedizierte Flex-Application-Insights- und Workspace-Ressourcen;
- getrenntes Host-/Deployment-Storage mit eigenem Container;
- erforderliche Managed Identity und, nur falls die geprüfte IaC dies verlangt, eng begrenzte und allowlistete RBAC-Assignments;
- neue App-Settings-/Config-Child-Ressourcen.

Nicht zulässig:

- Änderungen oder Deletes an bestehenden Y1-Apps;
- Änderungen an Cosmos, Business Storage, Queues, Blob-Containern oder Blob-Daten;
- Wiederverwendung der Legacy-Y1-Telemetrie als Flex-Telemetrie;
- Storage-Migration, Queue-Wechsel oder Blob-Datenumzug.

Die Draft-Ressourcen waren nach dem What-if nicht vorhanden. Zukünftige Flex-Application-Insights- oder Host-Storage-IDs wurden nicht vorausgesetzt.

**Package / release:** `func` Version `4.9.0`; `--build remote` ist verfügbar. `_deploy_staging/package.json` und `_deploy_staging/package-lock.json` vorhanden. `sharp` und `@resvg/resvg-js` sind enthalten. Der vorgeschriebene Weg bleibt `_deploy_staging/` mit Remote-Oryx: `--build remote --javascript`. Kein Package-Deployment ausgeführt. `mobile/eas.json` enthält weiterhin nur das bestehende Y1-`preview`-Profil; kein `preview-flex` erstellt.

**WP-B01 handoff:** Der aktuelle Queue-Fallback und Trigger verwenden weiterhin `AzureWebJobsStorage`:

- `backend/src/lib/queueClient.ts#L1`
- `backend/src/functions/reusableItemsEnrich.ts#L147`

Das bleibt bekannte Vorbereitungsarbeit für WP-B01 und wurde nicht implementiert. Die aktuelle Runtime-Drift ist DEV `Node|20` versus Alpha `Node|22`; bestehende Y1-Apps bleiben unverändert.

**No-mutation evidence:** Am `2026-09-29` wurden nicht ausgeführt:

- `az deployment group create`;
- Bicep-Deployment;
- Provider-Registrierung;
- Quota-Erhöhung;
- Blob-Schreibzugriff;
- Package-Deployment;
- EAS-Build;
- Code-, IaC-, Mobile- oder Test-Edits.

Die historische Ausführung ist wegen `WA-15` gestoppt; die beiden fehlenden Evidence-Arten wurden zusätzlich als `UNVERIFIED-QUOTA` und `UNVERIFIED-BLOB-DATA-READER` protokolliert. Nach WA-15-Evidence und neuer `APPROVE` muss WP-IR01 erneut read-only ausgeführt werden; kein Folge-WP darf direkt aus diesem Handoff gestartet werden. Unter der revidierten Policy blockieren die beiden historischen Codes weder WP-IR01 noch WP-B01. Die spätere Quota-Kontrolle nach Provisionierung bleibt ein harter Stop bei Unterversorgung oder widersprochener Standardbasis.

### WP-IR02 Backend-/IaC-/Build-Vorbereitung

**Agent:** Infrastructure

**Status:** Blocked — pending WP-IR01 `PASS` under the revised gate semantics and a new `APPROVE`. No IaC or configuration mutation is executed in this revision.

**Goal:** Flex-IaC und den releasefähigen Konfigurationsvertrag für DEV und Alpha anhand der bestätigten Zielwerte vorbereiten, mit getrennten Telemetrieflächen und unveränderten Business-Storage-Referenzen. Bei `PASS` bleiben `Always Ready = 0` und `Maximum Instances = 5` unverändert; bei jedem anderen IR01-Resultat wird dieses WP nicht gestartet.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- `infra/main.bicep`
- `infra/modules/functionapp.bicep`
- `infra/modules/storage.bicep`
- `infra/modules/appinsights.bicep`
- `infra/parameters/dev.bicepparam`
- `infra/parameters/alpha.bicepparam`
- `infra/README.md`
- `_deploy_staging/package.json`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-2
- AC-4
- AC-6

**Dependencies:**
- WP-IR01 `PASS` with `SUPPORTED` for `maximumInstanceCount = 5`;
- WP-B01 liefert die finalen Setting-Namen und den Queue-Vertrag;
- `Always Ready = 0` ist im freshen WP-IR01-Handoff `SUPPORTED`;
- `WA-15` ist unter dem conditional RG-scoped-`Contributor`-/Role-Assignment-Vertrag aufgelöst; bei keinen Role Assignments genügt RG-scoped `Contributor`, bei Assignments sind exakt erforderliche Permission(s), Scopes und Assignment-Allowlist evidenceiert. `UNVERIFIED-QUOTA` ist als nicht blockierende Preflight-Mess-Evidence zulässig und `UNVERIFIED-BLOB-DATA-READER` ist für diese Migration nicht erforderlich.

**Result:** `PASS`, wenn IaC, Parameter, die bestätigten Zielwerte, Contract-Validation und What-if-Allowlist ohne verbotene Änderungen reviewbar sind; `STOP`, wenn ein API-/Schema-/Scope-Fehler, ein unerwarteter What-if-Befund, ein Ersatzwert oder eine Business-Storage-Mutation droht; `UNVERIFIED`, wenn der read-only Contract-Handoff nicht ausreicht. Nur `PASS` entsperrt WP-B02.

**Expected Handoff:**
- reviewbare Flex-IaC-Komposition mit eindeutigen DEV-/Alpha-Parametern;
- Referenzen auf vorhandene Environment-Cosmos-/Business-Storage-Ressourcen, Queues, Blob-Container und Blob-Daten ohne Ersetzen, Verschieben oder Migrieren;
- verifizierte explizite Abbildung von `Always Ready = 0` und `Maximum Instances = 5` im exakten Flex-Scope ohne stillen Ersatzwert; der Default für `Always Ready` darf nicht als Ersatz für die fehlende explizite Darstellung verwendet werden;
- verifizierte Host-Storage-, Business-Storage-, Auth-, AI-, DI- und Telemetrie-Settings ohne Secretwerte, mit eigener Flex-Application-Insights-Instanz und getrennter Legacy-Y1-Telemetrie;
- read-only Bicep-/Schema-/What-if-Evidence, dass die neue Flex-Application-Insights-Instanz und das vertraglich erforderliche Host-/Deployment-Storage neu entstehen dürfen, während Shared-Resource-, Cosmos-, Business-Storage-, Queue-, Blob-Container- oder Blob-Daten-Delete/-Move/-Replace und unerwartete Y1-Änderungen ausgeschlossen sind;
- bestätigter Releasepfad für den Clean-Build-Artefakt.

### WP-IR03 Flex-DEV-Provisionierung

**Agent:** Infrastructure

**Status:** Blocked — pending WP-IR02 and WP-B02 `PASS` under the confirmed target-value contract. No Azure resource is provisioned in this revision.

**Goal:** Die neue Flex-Hosting-Komposition für DEV provisionieren und ihre Resource-/Setting-/Telemetry-Baseline einschließlich der unveränderten Business-Storage-Referenzen prüfen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- die von WP-IR02 übergebene Flex-IaC;
- `infra/parameters/dev.bicepparam`;
- `infra/modules/`;
- DEV-Cosmos-/Storage-Referenzen;
- `backend/src/lib/queueClient.ts`;
- `backend/src/functions/reusableItemsEnrich.ts`.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-4
- AC-6

**Dependencies:**
- WP-IR02 `PASS` with `Maximum Instances = 5`;
- WP-B02 liefert den geprüften Build-/Asset-Stand;
- no unresolved WA-15 or other blocking Annahmenfehler; the documented standard-Quota basis is carried into the post-provisioning check.

**Result:** `PASS`, wenn DEV-Ressourcen, Settings, Runtime, Telemetrie, Business-Storage-Referenzen und die tatsächliche Unterstützung des geplanten Workloads nach der Provisionierung eindeutig belegt sind; `STOP`, wenn What-if/Deployment oder Post-Checks eine verbotene Änderung zeigen, die Quota-Unterstützung fehlt oder die Standard-Quota-Basis widersprochen ist; `UNVERIFIED`, wenn erforderliche Resource-, Quota- oder Telemetrie-Evidence nicht vollständig gelesen werden kann. Nur `PASS` entsperrt WP-IR04.

**Expected Handoff:**
- DEV-Flex-Resource-IDs und Hostname;
- Runtime-/Plan-/Functions-v4-Nachweis;
- DEV-Datenquellen- und Setting-Evidence einschließlich des tatsächlichen Resource-/GET-Nachweises für `Always Ready = 0` und `Maximum Instances = 5` im verifizierten Flex-Scope; kein Wertwechsel; eine Abweichung löst das Failure Protocol aus;
- DEV-Post-Provisioning-Quota-Kontrolle mit dokumentierter Standardbasis, unterstütztem Workload-Ergebnis, Quelle und Zeitpunkt; kein erfundener aktueller Flex-Memory-Wert;
- Resource-ID-, Connection-String- und Query-Evidence für die separate Flex-Application-Insights-Instanz sowie die unveränderte, getrennte Legacy-Y1-Telemetrie;
- Control-Plane-Nachweis, dass keine bestehende Cosmos- oder Business-Storage-Ressource, Queue oder Blob-Container verändert, verschoben, ersetzt oder migriert wurden; Blob-Daten-Plane-Listing ist nicht erforderlich; zusätzliches Host Storage ist ausschließlich plattformtechnisch;
- bereitgestellte DEV-App für WP-IR04.

### WP-IR04 Vollständige DEV-Validierung und DEV-Gate-Handoff

**Agent:** Infrastructure

**Status:** Blocked — pending WP-IR03 and WP-B02 `PASS` with the confirmed target values. No DEV deployment or validation is executed in this revision.

**Goal:** Den Clean-Build-Artefakt auf DEV-Flex prüfen, alle technischen Kernflüsse gegen DEV-Ressourcen validieren und den Infrastructure-verantworteten `DEV-GATE`-Handoff mit harter PASS/STOP-Condition für Alpha liefern.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `_deploy_staging/`
- `backend/src/index.ts`
- `backend/src/functions/`
- `backend/src/lib/queueClient.ts`
- `backend/src/functions/reusableItems.ts`
- `backend/src/functions/reusableItemsEnrich.ts`
- `backend/src/functions/reusableItemsEnrichScheduler.ts`
- Renderer-Asset-Verzeichnis
- DEV-Flex-Resource- und Setting-Evidence aus WP-IR03

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-5
- AC-6
- AC-7
- AC-8

**Dependencies:**
- WP-IR03 `PASS` with `Maximum Instances = 5`;
- WP-B02 `PASS`;
- no unresolved external evidence gate or Annahmenfehler.

**Result:** `PASS` nur bei vollständiger DEV-Evidence einschließlich Health 200, Auth-401, CIAM, Queue-/Blob-Flows, AI/DI, Renderer, Telemetrie, Post-Provisioning-Quota-Kontrolle und Control-Plane-Storage-Baseline; `STOP` bei einem technischen Fehler, unzureichender oder widersprochener Quota-Basis, verbotener Mutation oder unklarem Setting; `UNVERIFIED` bei fehlender erforderlicher Evidence. Nur ein expliziter `DEV-GATE: PASS` entsperrt WP-IR05.

**Expected Handoff:**
- Function List mit `health`, HTTP-Funktionen, Queue-Trigger und Timer;
- `GET /api/health` HTTP 200, fehlendes/ungültiges Token HTTP 401 und gültiger CIAM-Testuser;
- reversible Profile-/Diary-Operation, Blob-Read/Upload, AI-/Document-Intelligence-Flow und 1080 x 1350 Renderer-Output;
- Linux-x64-Node-24-Nachweis für `sharp` und `@resvg/resvg-js` ohne Windows-Bindings;
- kontrollierter DEV-Queue-Producer-/Trigger-Smoke mit `STORAGE_CONNECTION_STRING` und `reusable-items-enrich`;
- Scheduler-Registrierung, Setting und Handler-Pfad verifiziert, aber kein zusätzlicher live Timerlauf erforderlich;
- DEV-Evidence für `Always Ready = 0` und `Maximum Instances = 5` im bestätigten Flex-Scope sowie für die separate Flex-Application-Insights-Instanz gegenüber der Legacy-Y1-Telemetrie;
- DEV-Post-Provisioning-Quota-Evidence mit dokumentierter Standardbasis, Quelle, Zeitpunkt und Ergebnis der Workload-Unterstützung;
- DEV-Control-Plane-Storage-/Queue-/Blob-Container-Evidence: bestehende DEV-Business-Storage-Ressource, Queue und Blob-Container unverändert weiterverwendet; keine Storage-Migration, kein Queue-Wechsel, kein Blob-Datenumzug und kein Ersatz durch Host Storage; keine Blob-Inventur erforderlich;
- DEV-Artefakt-Hash, Telemetrie und vollständige DEV-Evidence für AC-1 bis AC-7 sowie die statischen Vorbedingungen von AC-11, AC-14 und AC-15;
- Infrastructure-verantworteter `DEV-GATE`-Handoff mit eindeutigem `PASS` oder `STOP`;
- harte Stop-Condition: WP-IR05 darf nur bei eindeutigem `PASS` starten; bei `FAIL`, fehlender Evidence oder unklarer Setting-/Resource-Zuordnung bleibt jede Alpha-Mutation gesperrt. `DEV-GATE` ist keine QA-Stufe.

### WP-IR05 Alpha-Flex-Provisionierung

**Agent:** Infrastructure

**Status:** Blocked — pending `DEV-GATE: PASS` and the confirmed target values. No Alpha provisioning is executed in this revision.

**Goal:** Alpha-Flex nach dem `DEV-GATE` bereitstellen, ohne den bestehenden Y1-Stack, seine Legacy-Telemetrie oder bestehende Business-Storage-Ressourcen vor dem Alpha-Smoke zu verändern.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- Alpha-Flex-IaC aus WP-IR02;
- `infra/parameters/alpha.bicepparam`;
- Alpha-Cosmos-/Business-Storage-Referenzen;
- bestehende Alpha-Y1-Resource-IDs;
- Setting-Matrix aus WP-IR04.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-9

**Dependencies:**
- WP-IR04 `PASS` with complete `DEV-GATE` handoff;
- no open DEV evidence, quota STOP, blocking phase condition or Annahmenfehler.

**Result:** `PASS`, wenn Alpha-Flex mit Alpha-Datenquellen, separater Flex-Telemetrie, Host-Storage-Vertrag, `Always Ready`-/Instance-Evidence und nachgewiesener Workload-Unterstützung provisioniert ist und Y1 geschützt bleibt; `STOP` bei jedem What-if-, Deployment-, Quota- oder Schutzverstoß; `UNVERIFIED` bei fehlender erforderlicher Resource-/Quota-/Telemetry-Evidence. Nur `PASS` entsperrt WP-IR06.

**Expected Handoff:**
- Alpha-Flex-Resource-IDs und Hostname;
- Nachweis für Alpha-Cosmos, Alpha-Business-Storage, Shared AI/DI/CIAM und Host Storage;
- Nachweis für `Always Ready = 0` und `Maximum Instances = 5` im verifizierten Alpha-Flex-Scope sowie die separate Flex-Application-Insights-Instanz;
- Alpha-Post-Provisioning-Quota-Kontrolle mit dokumentierter Standardbasis, unterstütztem Workload-Ergebnis, Quelle und Zeitpunkt; kein erfundener aktueller Flex-Memory-Wert;
- Control-Plane-Nachweis, dass Alpha-Business-Storage, Queue und Blob-Container unverändert referenziert werden und keine Storage-Migration, kein Queue-Wechsel, kein Blob-Datenumzug oder Blob-Mutation stattfindet; keine Blob-Inventur erforderlich;
- Nachweis, dass Flex-Telemetrie nicht die Legacy-Y1-Connection verwendet und die Legacy-Y1-Telemetrie bis zum Alpha-Smoke getrennt erhalten bleibt;
- Y1-Schutz-Nachweis: bestehende App, Plan und zugehörige Ressourcen bleiben bis zum Alpha-Smoke unverändert;
- Alpha-App mit noch nicht live aktivierten Flex-Hintergrundfunktionen für den fokussierten Smoke.

### WP-IR06 Identischer Backend-Artefakt-Hash nach Alpha

**Agent:** Infrastructure

**Status:** Blocked — pending WP-IR05 and evidence for `Always Ready = 0` and `Maximum Instances = 5`. No Alpha package deployment is executed in this revision.

**Goal:** Den in DEV geprüften Backend-Artefaktstand ohne Neubau nach Alpha bringen und seine Identität nachweisen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- DEV-Artefaktmanifest und Hash aus WP-IR04;
- `_deploy_staging/`;
- Alpha-Flex-App aus WP-IR05;
- `infra/README.md`.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-5
- AC-9
- AC-10

**Dependencies:**
- WP-IR05 `PASS`;
- WP-B02 und WP-IR04 liefern denselben geprüften Artefaktstand sowie Evidence für `Always Ready = 0` und `Maximum Instances = 5`.

**Result:** `PASS`, wenn Alpha ohne Neubau exakt den DEV-Artefakt-Hash erhält und Runtime-/Function-/Storage-/Telemetry-Evidence vollständig ist; `STOP` bei Hashabweichung, stale staging oder falscher Environment-Zuordnung; `UNVERIFIED` bei fehlendem Hash- oder Deploy-Nachweis. Nur `PASS` entsperrt WP-M01.

**Expected Handoff:**
- Alpha-Deploy-Nachweis;
- Hashvergleich DEV zu Alpha ohne Abweichung;
- Function List und Runtime-Nachweis auf Alpha;
- Flex-Betriebs-, separate-Telemetrie- und unveränderte Business-Storage-Evidence für Alpha;
- dokumentierter Stand der noch nicht aktivierten Queue-/Timer-Funktionen.

### WP-IR07 Verbindlicher `preview-flex`-EAS-Build

**Agent:** Infrastructure

**Status:** Blocked — pending WP-M01, WP-IR06 and the target-value handoff for `Always Ready = 0` and `Maximum Instances = 5`. No EAS build is created in this revision.

**Goal:** Nach dem identischen Alpha-Backend-Deploy den wegen der build-time eingebetteten `EXPO_PUBLIC_API_URL` zwingenden `preview-flex`-EAS-Build erstellen und als Handoff für den fokussierten Alpha-Smoke bereitstellen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- `mobile/eas.json` nach WP-M01;
- `mobile/app.config.js`;
- `mobile/package.json`;
- Alpha-Flex-Hostname aus WP-IR05;
- Alpha-Backend-Artefakt- und Runtime-Evidence aus WP-IR06.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-11
- AC-12

**Dependencies:**
- WP-M01 PASS mit dem statischen `preview-flex`-Config-Handoff;
- WP-IR06 PASS mit identischem Backend-Artefakt-Hash auf Alpha.

**Result:** `PASS` nur mit installierbarer Build-ID, direkter Alpha-Flex-URL einschließlich `/api` und unveränderter öffentlicher Konfiguration; `STOP` bei Buildfehler, falscher URL, Secret oder fehlender Build-ID; `UNVERIFIED` bei nicht prüfbarer eingebetteter URL. Nur `PASS` entsperrt WP-IR08.

**Dev Build Required:** Infrastructure & Release trifft die abschließende `YES | NO`-Entscheidung nach der lokalen Build-/Profilprüfung. Dieses Signal ändert nicht die Pflicht, den neuen `preview-flex`-Preview-Build vor WP-IR08 zu erstellen; ein Preview-Build ist nicht automatisch ein Development Build.

**Expected Handoff:**
- installierbare `preview-flex`-EAS-Build-ID mit direkter Alpha-Flex-URL einschließlich `/api`;
- Nachweis der build-time eingebetteten URL und der unveränderten öffentlichen CIAM-, Variant- und Package-Werte;
- expliziter Build-Nachweis als zwingende Voraussetzung für WP-IR08; der Build ist nicht optional und darf nicht durch das bestehende Y1-Preview-Artefakt ersetzt werden;
- Nachweis, dass der Build keine native Modul-, Config-Plugin-, `app.config.js`-, Package-ID-, Screen- oder Navigationsänderung enthält;
- eindeutiger STOP-Befund, falls Build-ID, URL oder öffentliche Konfiguration fehlen oder abweichen.

### WP-IR08 Fokussierter Alpha-Smoke

**Agent:** Infrastructure

**Status:** Blocked — pending completed Alpha deployment and the mandatory `preview-flex` build. No Alpha smoke is executed in this revision.

**Goal:** Den direkten Flex-Endpoint und die wichtigsten Backend-Verträge mit einem begrenzten, reversiblen Alpha-Smoke bestätigen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- Alpha-Flex-App aus WP-IR05;
- Hash-Evidence aus WP-IR06;
- `mobile/eas.json` nach WP-M01;
- `mobile/src/shared/api/client.ts`;
- `mobile/src/services/authConfig.ts`;
- `backend/src/index.ts` und die relevanten Handler;
- kontrollierter Alpha-Testuser und vorhandene Testdaten.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-9
- AC-10
- AC-11
- AC-12

**Dependencies:**
- WP-IR06 PASS;
- WP-M01 PASS;
- WP-IR07 PASS mit installierbarer `preview-flex`-Build-ID.

**Result:** `PASS`, wenn der fokussierte Client-/Backend-Smoke vollständig besteht; `STOP` bei einem ungeklärten Vertrags-, Daten-, Auth-, Telemetrie-, Client- oder Business-Storage-Mutationsfehler; `UNVERIFIED` bei fehlender Testuser-, Build- oder erforderlicher Evidence-Voraussetzung. Blob-Daten-Plane-Inventur ist kein Bestandteil des Smokes. Nur `PASS` entsperrt WP-IR09.

**Expected Handoff:**
- die installierbare `preview-flex`-Build-ID aus WP-IR07 mit direkter Flex-URL;
- Health 200, geschützter 401, gültiger CIAM-Login/Refresh und API-Client-Nachweis;
- reversible Datenoperation, Blob-Read/Upload, AI-/Document-Intelligence-Flow und Renderer-Smoke;
- Function List, Runtime-, separate-Flex-Application-Insights-, Legacy-Y1-Telemetrie- und Artefakt-Hash-Evidence;
- Control-Plane-Nachweis, dass Alpha-Business-Storage, Queue und Blob-Container unverändert bleiben und der Client-Smoke keine Storage-Migration, Datenverschiebung oder Blob-Mutation auslöst; keine Blob-Inventur erforderlich;
- eindeutiger PASS/STOP-Befund. Queue- und Timer-Live-Ausführung gehört noch nicht zu diesem Smoke.

### WP-IR09 Explizites Y1-Decommission und kontrollierter Hintergrund-Smoke

**Agent:** Infrastructure

**Status:** Blocked — pending Alpha-Smoke `PASS` and evidence for `Always Ready = 0` and `Maximum Instances = 5`. No Y1 decommission or background activation is executed in this revision.

**Goal:** Erst nach Alpha-Smoke-PASS das nicht mehr benötigte Y1-Hosting entfernen, Flex-Hintergrundfunktionen aktivieren und genau den notwendigen Queue-/Timer-Smoke ausführen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- Alpha-Smoke-Evidence aus WP-IR08;
- Y1- und Flex-Resource-IDs;
- `infra/` und die Release-Parameter;
- `backend/src/lib/queueClient.ts`;
- `backend/src/functions/reusableItems.ts`;
- `backend/src/functions/reusableItemsEnrich.ts`;
- `backend/src/functions/reusableItemsEnrichScheduler.ts`;
- Application-Insights-/Telemetry-Abfragen.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-12
- AC-13
- AC-14

**Dependencies:**
- WP-IR08 PASS;
- keine offene Daten-, Auth-, Runtime- oder Artefakt-Blockade;
- Decommission-Parameter und Recovery-Referenzen sind festgehalten.

**Result:** `PASS`, wenn ausschließlich erlaubte Y1-Hostingressourcen entfernt, Flex-Hintergrundfunktionen aktiviert und Queue-/Timer-Smokes exakt einmal erfolgreich ausgeführt wurden; `STOP` vor jeder Decommission-Mutation bei nicht bestandenem Alpha-Smoke oder unklarem Scope; `UNVERIFIED` bei fehlendem Schutz-/Post-Check. Nur `PASS` entsperrt WP-IR10.

**Expected Handoff:**
- gezielter Decommission-Nachweis nur für Y1-App, Y1-Plan und ausschließlich hostbezogene, nicht mehr benötigte Ressourcen;
- Schutz-Nachweis für Cosmos, Business Storage, Queue, Blob-Container und Blob-Daten, CIAM, OpenAI, Document Intelligence, die separate Flex-Application-Insights-Instanz und die getrennte Legacy-Y1-Telemetrie; die Blob-Daten werden über den unveränderten Schutzvertrag, nicht über eine Inventur, behandelt;
- expliziter Control-Plane-/What-if-Nachweis, dass keine Business-Storage-Ressource, Queue oder Blob-Container entfernt, verändert, verschoben, ersetzt oder migriert wurde; jede tatsächliche Blob-Mutation oder Migration ist STOP;
- Flex-Queue-Trigger und Flex-Timer nach dem Decommission aktiviert;
- genau eine kontrollierte neue `reusable-items-enrich`-Nachricht mit genau einer Verarbeitung über die explizite Business-Storage-Verbindung;
- genau ein kontrollierter Scheduler-/Timer-Smoke nach der Aktivierung, ohne doppelte Verarbeitung;
- Telemetrie- und Recovery-Evidence sowie Bestätigung, dass keine laufende Legacy-Instanz zurückbleibt.

### WP-IR10 Release-Dokumentation

**Agent:** Infrastructure

**Status:** Blocked — pending WP-IR09 `PASS` with the confirmed target values. No release record is created or updated in this revision.

**Goal:** Den tatsächlich ausgeführten Infrastruktur- und Releasezustand secretfrei und reproduzierbar dokumentieren.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `infra/README.md`;
- `infra/release-records/`;
- DEV-/Alpha-Artefakt-Hashes;
- WP-IR01 bis WP-IR09 Evidence;
- `mobile/eas.json`;
- Recovery-Commit, IaC-Version und Parameterreferenzen.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-14
- AC-15

**Dependencies:**
- WP-IR09 PASS.

**Result:** `PASS`, wenn Release-Record, DEV-/Alpha-Quota-Kontroll-Evidence und Recovery-/No-Migration-Evidence vollständig und secretfrei sind; `STOP` bei fehlender, widersprüchlicher oder quota-widersprechender Dokumentation; `UNVERIFIED` bei nicht belegbarem ausgeführtem Zustand. Nur `PASS` entsperrt WP-QA-Final.

**Expected Handoff:**
- Release-Record mit Runtime, `Always Ready = 0`, `Maximum Instances = 5` einschließlich verifiziertem Flex-Scope, DEV-/Alpha-Quota-Kontroll-Evidence mit dokumentierter Standardbasis und Workload-Ergebnis, separater Flex-Application-Insights-Resource-ID, getrennter Legacy-Y1-Telemetrie, Resource-Zuordnung, Hash, verpflichtender `preview-flex`-Build-ID sowie Smoke- und Decommission-Evidence; ein abweichender Wert oder Scope ist ein Plan-Assumption-Failure und kein Release-Ergebnis;
- Control-Plane-Storage-/Queue-/Blob-Container-Evidence und What-if-/No-Mutation-Evidence, dass keine Storage-Migration, kein Queue-Wechsel, kein Blob-Datenumzug, keine Blob-Mutation und kein Ersetzen bestehender DEV-/Alpha-Business-Storage-Ressourcen stattgefunden hat; keine Blob-Inventur oder Data-Reader-Evidence wird als Releasevoraussetzung verlangt;
- dokumentierte Wiederherstellung aus Git/IaC/Artefakt/Parametern;
- keine Secretwerte, Tokens, Connection Strings oder internen User-IDs;
- dokumentierte Planner-Nacharbeit für die KB-Änderungen außerhalb der Phase-2-Ausführung und ohne Orchestrator-Routingabhängigkeit.

## 13. Mobile Work Package

### WP-M01 Einfache `preview-flex`-EAS-Konfiguration

**Agent:** Frontend

**Status:** Blocked — pending WP-IR05 supplies the Alpha-Flex hostname. No mobile configuration is changed in this revision.

**Goal:** Genau einen technischen Buildzeitpfad mit direktem Alpha-Flex-Hostname konfigurieren und den verpflichtenden Infrastructure-Build-Handoff für den fokussierten Client-Smoke vorbereiten.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/05-authentication.md`

**Required Repository Context:**
- `mobile/eas.json`;
- `mobile/src/shared/api/client.ts`;
- `mobile/src/services/authConfig.ts`;
- `mobile/app.config.js`;
- Alpha-Flex-Hostname aus WP-IR05.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-11
- AC-12

**Dependencies:**
- WP-IR05 liefert den direkten Flex-Hostname.

**Result:** `PASS`, wenn genau das statische Profil-Handoff ohne native Änderung vorliegt; `STOP` bei falscher URL, geänderten öffentlichen Werten oder zusätzlicher Mobile-Scope-Änderung; `UNVERIFIED` bei fehlendem Alpha-Flex-Hostname. Nur `PASS` entsperrt WP-IR07.

**Expected Handoff:**
- genau ein `preview-flex`-Profil in `mobile/eas.json` mit Flex-URL inklusive `/api`;
- unveränderte öffentliche CIAM-, Variant- und Package-Werte;
- keine Secrets, keine Screens-/Navigation-Änderung, keine `app.config.js`- oder Native-Änderung;
- statischer Config-Nachweis an WP-IR07;
- verbindlicher Handoff an Infrastructure für WP-IR07: Der neue `preview-flex`-EAS-Build wird vor WP-IR08 erstellt und ist für den Alpha-Client-Smoke zwingend. Die Buildausführung bleibt bei Infrastructure & Release.

Die Entscheidung für diesen Pfad ist technisch begründet: `EXPO_PUBLIC_API_URL` wird build-time eingebettet, und ein Client-Smoke gegen den direkten Flex-Host kann deshalb nicht mit dem bestehenden Y1-Preview-Artefakt erfolgen. Die Änderung ist reine URL-/JS-Konfiguration ohne native Module, Config-Plugin, `app.config.js`-, Package-ID-, Screen- oder Navigationsänderung. Der neue EAS-Build ist deshalb trotz `no Native Impact` verbindlich; Infrastructure & Release liefert die Build-ID als zwingenden Handoff, nicht als optionale Bewertung.

## 14. QA Work Package

QA erhält den vollständigen Acceptance-Criteria-Satz `AC-1` bis `AC-17`. Der `DEV-GATE`-Handoff in WP-IR04 ist eine Infrastructure-Aufgabe mit harter PASS/STOP-Bedingung und keine QA-Stufe oder QA-Subtask. Der einzige QA-Aufruf ist das terminale Work Package am Ende. QA ändert keine Produktionslogik, kein IaC und keine Mobile-Konfiguration.

### WP-QA-Final Abschluss-QA-Review

**Agent:** QA

**Status:** Blocked — pending WP-IR10 and complete execution evidence under a future approved execution state. This persisted revision is not approved; QA reviews the resolved plan and evidence only, and does not resolve technical assumptions or execute mutations.

**Goal:** Nach Release- und Infrastrukturdokumentation den tatsächlich ausgeführten Zustand einschließlich der vollständigen `DEV-GATE`-Evidence gegen den vollständigen AC-Satz prüfen und dokumentieren.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md`;
- `docs/qa/reports/README.md`;
- `infra/release-records/`;
- `infra/`;
- `backend/`;
- `_deploy_staging/`;
- `mobile/eas.json`;
- `infra/README.md`;
- vollständiger `DEV-GATE`-Handoff aus WP-IR04.

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-1 bis AC-17.

**Dependencies:**
- WP-IR04 PASS mit vollständigem `DEV-GATE`-Handoff;
- WP-IR09 liefert Decommission- und Queue-/Timer-Smoke-Evidence;
- WP-IR10 PASS.

**Result:** QA liefert genau ein Verdict `PASS`, `PASS WITH ISSUES` oder `FAIL`. Fehlende oder nicht reproduzierbare Evidence wird als `UNVERIFIED` beziehungsweise `MANUAL VALIDATION REQUIRED` außerhalb der Findings ausgewiesen und darf nicht als PASS gewertet werden.

**Expected Handoff:**
- QA-Bericht unter dem vom Orchestrator vorgegebenen Pfad, regulär `docs/qa/reports/PLAN_Node24-Flex-Migration.md`;
- genau ein Verdict `PASS`, `PASS WITH ISSUES` oder `FAIL`;
- jedes AC genau einmal in der vollständigen Kriterienmatrix einschließlich der DEV-Gate-Evidence aus WP-IR04 und der finalen Scope-/Assumption-Evidence;
- `UNVERIFIED` und `MANUAL VALIDATION REQUIRED` getrennt von Findings;
- keine Änderungen an Produktionscode, IaC oder Mobile-Konfiguration.

## 15. Shared Package Changes

**Status:** None.

Es gibt keine Änderung an `shared/types/` oder `shared/lib/`. API-DTOs, Response-Formate und mobile API-Typen bleiben unverändert.

## 16. Persistence Impact

**Migration class:** Class 0 / no migration.

Es werden keine Cosmos-Dokumenttypen, Felder, Container, Partition Keys oder Repository-Verträge geändert. Die Queue-Korrektur betrifft ausschließlich die Verbindungs- und Binding-Konfiguration. Bestehende DEV- und Alpha-Dokumente bleiben unverändert und werden weder kopiert noch zurückgeschrieben.

## 17. Infrastructure and Configuration

### Development

DEV-Flex referenziert ausschließlich DEV-Cosmos und den bestehenden DEV-Business-Storage. Shared OpenAI, Document Intelligence und CIAM bleiben die bestehenden Dienste. `STORAGE_CONNECTION_STRING` zeigt auf den unveränderten DEV-Business-Storage; Queue `reusable-items-enrich`, Blob-Container und Blob-Daten werden unverändert weiterverwendet. Das Flex-Host-Storage-Setting wird nur für Plattformzwecke verwendet und ersetzt kein Business Storage. `Always Ready = 0` und `Maximum Instances = 5` werden mit ihrem verifizierten Flex-Scope nachgewiesen; jede Abweichung beendet die aktuelle Planversion über das Failure Protocol. Die dokumentierte Standard-Flex-Quota wird als Arbeitsbasis festgehalten und nach DEV-Provisionierung mit Workload-Ergebnis, Quelle und Zeitpunkt kontrolliert; Unterversorgung oder widersprochene Basis ist ein harter WA-06-STOP. Die separate Flex-Application-Insights-Instanz wird über eigene Resource-ID/Connection-String-Evidence von der Legacy-Y1-Telemetrie getrennt. Der DEV-Queue-Trigger darf für die vollständige Queue-Validierung aktiv sein. Der Scheduler wird vor Alpha nicht als zusätzlicher live Timerlauf benötigt. Control-Plane-Referenzen, What-if-Allowlist und No-Mutation-Evidence schützen Business Storage; eine Blob-Inventur ist nicht erforderlich. Es gibt keine Storage-Migration, keinen Queue-Wechsel und keinen Blob-Datenumzug.

### Alpha

Alpha-Flex referenziert ausschließlich Alpha-Cosmos und den bestehenden Alpha-Business-Storage. Queue `reusable-items-enrich`, Blob-Container und Blob-Daten bleiben unverändert; es gibt keine Storage-Migration, keinen Queue-Wechsel, keinen Blob-Datenumzug und kein Ersetzen der bestehenden Ressourcen. `Always Ready = 0` und `Maximum Instances = 5` gelten im verifizierten Alpha-Flex-Scope; jede Abweichung beendet die aktuelle Planversion über das Failure Protocol. Die dokumentierte Standard-Flex-Quota wird auch nach Alpha-Provisionierung mit Workload-Ergebnis, Quelle und Zeitpunkt kontrolliert; Unterversorgung oder widersprochene Basis ist ein harter WA-06-STOP. Alpha verwendet die separate Flex-Application-Insights-Instanz und bleibt von der Legacy-Y1-Telemetrie getrennt. Der Y1-Stack bleibt bis zum PASS des fokussierten Alpha-Smokes unverändert. Control-Plane-Referenzen, What-if-Allowlist und No-Mutation-Evidence schützen Business Storage; eine Blob-Inventur ist nicht erforderlich. Queue-Trigger und Timer bleiben bis zum anschließenden Decommission-Schritt nicht live aktiviert. Der Backend-Hash muss dem DEV-Hash entsprechen.

### Shared-resource protection

Das Decommission darf nur die alte Y1-App, ihren Y1-Plan und ausschließlich hostbezogene, nicht mehr benötigte Ressourcen entfernen. Bestehende Cosmos-/Business-Storage-Ressourcen, Queues, Blob-Container und Blob-Daten werden nicht entfernt, verändert, verschoben, ersetzt oder migriert. CIAM, OpenAI, Document Intelligence, die separate Flex-Application-Insights-Instanz und die erforderliche getrennte Legacy-Y1-Telemetrie werden vor und nach der Aktion anhand ihrer Resource-IDs geprüft und geschützt. Ein Flex-Host-Storage darf nicht als Business-Storage-Ersatz behandelt werden.

### Secrets and permissions

Secretwerte bleiben in lokalen beziehungsweise Azure-Secretquellen. Plan, Git-Diff, Logs, Screenshots, Handoffs und Release-Records enthalten nur Setting-Namen, Resource-IDs ohne Geheimwerte, Hashes und redigierte Evidence. Neue Identitäten erhalten keine Owner- oder Subscription-scoped-`Contributor`-Rechte. Eine dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller` ist nur dann die ausreichende Basis, wenn die IaC keine Role Assignments erstellt; bei Role Assignments werden nur die exakt erforderlichen `roleAssignments/write`- oder engeren Permission(s) am konkreten Assignment-Scope und mit Assignment-Allowlist verlangt. Nicht read-only bestätigbare Permission oder Scope führt zu `UNVERIFIED-PERMISSIONS`/`STOP`; der Executor repariert Azure-RBAC nicht selbst.

## 18. Documentation Updates

- Infrastructure & Release erstellt den Release-Record mit Runtime, Resource-Matrix, Artefakt-Hashes, Smoke-Evidence, Decommission-Scope und Recovery-Referenzen.
- Der Release-Record enthält zusätzlich `Always Ready = 0`, `Maximum Instances = 5` mit verifiziertem Flex-Scope, die DEV-/Alpha-Quota-Kontroll-Evidence auf Basis der dokumentierten Standard-Quota ohne erfundenen aktuellen Messwert, die separate Flex-Application-Insights-Resource-ID gegenüber der Legacy-Y1-Telemetrie, die verpflichtende `preview-flex`-Build-ID und die Control-Plane-/What-if-/No-Mutation-Evidence für Storage, Queue und Blob-Container ohne Storage-Migration, Queue-Wechsel, Blob-Datenumzug oder Blob-Mutation. Eine Abweichung ist als Plan-Assumption-Failure zu dokumentieren und darf nicht als Releasezustand erscheinen.
- Infrastructure & Release aktualisiert `infra/README.md` und betroffene Release-Dokumentation nur auf den tatsächlich ausgeführten Stand.
- Planner aktualisiert nach dem ausgeführten Release die betroffenen KB-Dokumente, mindestens `docs/kb/tech/01-system-overview.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/03-mobile.md` und `docs/kb/tech/07-infrastructure.md`, sofern sich deren Ist-Zustand geändert hat. Diese dokumentierte Nacharbeit ist kein Phase-2-Work-Package und erscheint nicht in der Recommended Execution Order.
- `docs/kb/tech/09-api-reference.md` wird nur geändert, falls entgegen diesem Plan ein API-Vertrag betroffen wäre; im geplanten Umfang bleibt es unverändert.
- Geplante Aussagen bleiben bis zur Umsetzung mit `[Planned]` gekennzeichnet. Keine Dokumentation enthält Secretwerte.
- Der abschließende QA-Bericht aus WP-QA-Final ist der verbindliche terminale Nachweis für den vollständigen Acceptance-Criteria-Satz.

## 19. Test Strategy

### Local and static gates

- Node-24-LTS-Version und npm-Version protokollieren;
- **Verbindlicher lokaler Backend-Startup-/Smoke-Gate nach jeder Manifest-/Lockfile- oder Backend-Änderung:** Der Lauf startet aus `backend/` mit exakt `npm run dev` (nicht aus dem Repository-Root). Zu belegen sind der erfolgreiche Build aus `dev.mjs`, die HTTP-Bereitschaft von Azurite für Blob, Queue und Table, die angelegte lokale Queue `reusable-items-enrich`, ein Functions-Host auf Port 7071 und `GET http://localhost:7071/api/health` mit HTTP 200. Danach wird der Prozess kontrolliert per SIGINT/Ctrl+C beendet; es dürfen keine von `dev.mjs` gestarteten Prozesse zurückbleiben. Jeder Fehler wird der ersten fehlgeschlagenen Phase zugeordnet und mit redigierter Diagnose dokumentiert.
- Voraussetzungen und Abgrenzung: Workspace-Abhängigkeiten sind per `npm install` aus dem Root vorhanden, Azure Functions Core Tools v4 ist verfügbar, `backend/local.settings.json` liegt lokal aus dem Template vor und Port 7071 ist frei. Die Datei bleibt gitignored; Secretwerte werden nicht in Logs, Handoffs oder Evidence aufgenommen. `UseDevelopmentStorage=true`, `FITTRACK_AZURITE_LOCATION` und lokale Cosmos-Emulator-Einstellungen sind lokale Testkonfigurationen, nicht Flex-Host-Storage und keine Anweisung zur Änderung von Azure-Ressourcen.
- Root-, Shared-, Backend- und Mobile-Typechecks im betroffenen Scope;
- Backend- und Shared-Vitest-Suites sowie die relevanten Mobile-Tests;
- `npm run build:verify` mit Clean Build, Renderer-Asset-Copy und Import-Guard;
- `git diff --check`, Encoding- und Secret-Leak-Prüfung ohne Ausgabe lokaler Werte;
- Bicep Build/Lint/What-if nach dem read-only Flex-Schema-Preflight;
- read-only Prüfung der aktuellen Flex-Syntax/API-Version, Unterstützung und des Scopes für `Always Ready = 0` und den Zielwert `Maximum Instances = 5`; die Prüfung klassifiziert den Quickstart-Decorator getrennt von der Provider-/Dienstregel und liefert `SUPPORTED`, `UNSUPPORTED` oder `UNVERIFIED`; Default, explizite Darstellung und Post-Provisioning-Evidence für `Always Ready` bleiben getrennt;
- read-only Dokumentation der Standard-Flex-Quota als Arbeitsbasis im WP-IR01; keine Behauptung eines präzisen aktuellen Subscription-Werts, keine Registrierung von `Microsoft.Quota` und kein Quota-Increase nur für Evidence;
- Post-Provisioning-Quota-Kontrolle in WP-IR03 und WP-IR05 mit Workload-Unterstützung, Quelle und Zeitpunkt; Unterversorgung oder widersprochene Basis erzeugt den WA-06-STOP-Code;
- keine Blob-Inventur, kein Digest und keine `Storage Blob Data Reader`-Voraussetzung für diese Migration;
- Resource-/Connection-String-Prüfung für die separate Flex-Application-Insights-Instanz gegenüber der Legacy-Y1-Telemetrie;
- `what-if`-/Control-Plane-Referenzprüfung, dass bestehende DEV-/Alpha-Business-Storage-Ressourcen, Queues und Blob-Container unverändert bleiben und keine Storage-Migration, kein Queue-Wechsel, kein Blob-Datenumzug oder Blob-Mutation vorgesehen ist;
- statische Prüfung von `STORAGE_CONNECTION_STRING`, `AzureWebJobsStorage`, `ENRICH_QUEUE_NAME` und der Queue-Trigger-Binding.

### Linux-x64 native gate

In einer frischen Linux-x64-Node-24-Umgebung müssen `sharp` und `@resvg/resvg-js` laden. Windows-native Bindings dürfen nicht im Produktionsartefakt liegen. Der Renderer muss ein nicht leeres PNG mit exakt 1080 x 1350 Pixeln erzeugen. Der vollständige Asset-Mirror muss im Build- und Staging-Pfad vorhanden sein.

### DEV validation

DEV prüft Runtime/Plan, `Always Ready = 0`, `Maximum Instances = 5` im verifizierten Scope, die Post-Provisioning-Quota-Kontrolle auf Basis der dokumentierten Standard-Quota, Function List, Health 200, 401 ohne gültigen Token, gültigen CIAM-Testuser, reversible Datenflüsse, unveränderten Business-Storage, Control-Plane-Queue-/Blob-Container-Referenzen, AI-/Document-Intelligence-Flow, Renderer, die separate Flex-Application-Insights-Instanz und die explizite Business-Queue-Verbindung. Storage-Migration, Queue-Wechsel, Blob-Datenumzug und Blob-Mutation müssen ausgeschlossen sein; eine Blob-Inventur ist nicht erforderlich. Der Scheduler wird auf Registrierung, Konfiguration und Handler-Vertrag geprüft; der live Timer-Smoke bleibt dem Schritt nach Decommission vorbehalten.

### Alpha smoke

Der fokussierte Alpha-Smoke prüft den identischen Backend-Hash, Runtime, Function List, Health 200, 401, CIAM, reversible Datenoperation, unveränderten Business-Storage, Control-Plane-Queue-/Blob-Container-Referenzen, AI/DI, Renderer, die separate Flex-Application-Insights-Telemetrie und den direkten `preview-flex`-Clientpfad mit der verpflichtenden Build-ID. Die Alpha-Quota-Kontrolle erfolgt bereits in WP-IR05 und wird im Smoke-/Release-Handoff referenziert. Queue- und Timer-Livefunktionen werden erst nach dem Y1-Decommission kontrolliert geprüft; der Smoke darf keinen Queue-Wechsel, Blob-Datenumzug, Blob-Mutation oder Ersatz von Business Storage auslösen. Eine Blob-Inventur ist nicht erforderlich.

### Queue and timer smoke after decommission

Nach Aktivierung der Flex-Hintergrundfunktionen wird eine kontrollierte Nachricht in der unveränderten Business-Queue erzeugt und genau einmal verarbeitet. Danach wird genau ein kontrollierter Scheduler-/Timer-Lauf ausgelöst oder über den unterstützten Triggerpfad verifiziert. Erwartet werden korrekte Environment-Zuordnung, keine Doppelverarbeitung, keine Storage-Migration, kein Queue-Wechsel, kein Blob-Datenumzug und keine Nutzung der Host-Storage-Verbindung als Business-Queue.

### Recovery validation

Der Release-Record muss den letzten funktionierenden Git-Commit, den Artefakt-Hash, die IaC-Version, die Parameterreferenzen, die Flex-Betriebswerte mit Scope, die separate Flex-Application-Insights-Resource-ID und die verpflichtende `preview-flex`-Build-ID nennen. Vor dem Decommission wird geprüft, dass diese Eingaben eine erneute Provisionierung beziehungsweise einen erneuten Build ermöglichen, ohne bestehendes Business Storage, Queues, Blob-Container oder Blob-Daten zu verschieben oder zu ersetzen. Nach dem Decommission wird keine laufende Legacy-Instanz als Voraussetzung für Recovery angenommen.

## 20. Acceptance Criteria

- **AC-1:** Die Planrevision trägt den revidierten Status mit Warten auf WA-15-Identity-/Scope-Evidence einschließlich der bedingten Role-Assignment-Fähigkeitsprüfung und neue explizite `APPROVE`, `Infrastructure Impact: Alpha` und `Mobile Build Impact: None`. Sie dokumentiert, dass die frühere Zustimmung invalidiert ist, dass die neue `APPROVE` für diese gespeicherte Revision erst nach dieser WA-15-Evidence gilt, und dass ein Planfehler über das Failure Protocol zum Planner zurückführt. Die Ausführung ist strikt sequenziell und zirkelfrei.
- **AC-2:** Das erneute WP-IR01 bestätigt read-only die zum Ausführungszeitpunkt unterstützte Flex-SKU/API, Region, Node-24-LTS-Runtime, Functions Runtime v4, Permissions und den Package-Deployment-Weg. Es prüft die tatsächliche dedizierte Deployment-Identität mit RG-only-Scope und die geplante IaC auf Role Assignments: Ohne Assignments ist RG-scoped `Contributor` die Basis; mit Assignments werden nur exakt erforderliche Permission(s), Scopes und die Assignment-Allowlist bestätigt; nicht read-only bestätigbare Assignment-Fähigkeit ist `UNVERIFIED-PERMISSIONS`/`STOP`. Die dokumentierte Standard-Flex-Quota wird als Arbeitsbasis für den kleinen DEV-/Alpha-Workload und mit ihrem Geltungsbereich festgehalten; eine subscription-spezifische Messung ist nicht erforderlich, ein fehlender Messwert bleibt als nicht blockierendes `UNVERIFIED-QUOTA` dokumentiert. Der bestehende Handoff-Befund `Always Ready = 0: SUPPORTED` wird durch die getrennte Matrix aus Default, expliziter IaC-/ARM-Darstellung und späterem Post-Provisioning-Wert auf Drift geprüft; eine spätere Nichtunterstützung ist `PLAN-ASSUMPTION-INVALID:WA-05` plus `STOP-AR0-UNSUPPORTED`, eine nicht entscheidbare Evidence `UNVERIFIED-AR0-EXPLICIT`, und beides blockiert Mutation. Der bestehende Handoff-Befund `Maximum Instances = 5: SUPPORTED` wird durch Template-Parameter/Decorator, ARM-/Provider-Schema, exakten Property-Pfad, Scope und den erfolgreichen read-only Validierungsweg auf Drift geprüft; eine spätere Ablehnung erzeugt `PLAN-ASSUMPTION-INVALID:WA-04` plus `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED`, eine nicht entscheidbare Revalidierung `UNVERIFIED-MAXIMUM-INSTANCE-SCOPE`. Nur ein vollständiger `PASS` entsperrt WP-B01.
- **AC-3:** Root-, Backend- und Staging-Manifeste sind für Node 24 konsistent. Producer und Queue-Trigger verwenden ausschließlich dieselbe explizite `STORAGE_CONNECTION_STRING` für `reusable-items-enrich`; kein Codepfad fällt auf `AzureWebJobsStorage` zurück.
- **AC-4:** Die Flex-IaC referenziert die bestehenden DEV-/Alpha-Cosmos- und Business-Storage-Ressourcen. Eine neue Flex-Application-Insights-Instanz und vertraglich erforderliches Host-/Deployment-Storage dürfen als neue Plattformressourcen entstehen; ihr vorheriges Fehlen ist kein Preflight-Fehler. Die IaC-Prüfung dokumentiert, ob Flex Host Storage, Managed Identity oder ein anderer IaC-Teil neue Role Assignments erstellt; ohne Assignments wird dies explizit vermerkt, mit Assignments werden nur die exakt erforderlichen Permission(s), Scopes und die Assignment-Allowlist zugelassen. Bestehende Queues und Blob-Container werden über Control-Plane-Referenzen, Settings, GETs, What-if-Allowlist und No-Mutation-Evidence unverändert weiterverwendet; es gibt keine Storage-Migration, keinen Queue-Wechsel, keinen Blob-Datenumzug, keine Blob-Mutation und kein Ersetzen bestehender Business-Storage-Ressourcen. Eine Blob-Inventur, ein Digest und `Storage Blob Data Reader` sind keine Voraussetzungen und `UNVERIFIED-BLOB-DATA-READER` ist kein blockierender Befund. Es entstehen keine neuen Cosmos-Container oder Datenmigrationen, Shared OpenAI/Document Intelligence/CIAM bleiben geschützt, und `what-if` zeigt keine unerwarteten Deletes oder Änderungen an bestehenden Ressourcen.
- **AC-5:** Clean Build, betroffene Tests, `build:verify`, Asset-Mirror, Encoding-/Secret-Leak-Check und Linux-x64-Native-Gate bestehen; `sharp`, `@resvg/resvg-js` und der 1080-x-1350-Renderer funktionieren unter Node 24. Nach jeder Manifest-/Lockfile- oder Backend-Änderung besteht zusätzlich der lokale Startup-/Smoke-Gate aus `backend/` mit exakt `npm run dev`: Build erfolgreich, Azurite und `reusable-items-enrich` bereit, Functions-Host auf Port 7071, `GET http://localhost:7071/api/health` HTTP 200, kontrollierte saubere Beendigung ohne verwaiste Prozesse und phasengenaue Fehlerdiagnose. Das Gate verwendet nur lokale Settings/Emulatoren; `local.settings.json` bleibt gitignored und secretfrei in der Evidence, Flex-Host-Storage und Azure-Ressourcen werden nicht verändert.
- **AC-6:** Flex-DEV ist provisioniert und meldet die verifizierte Hostingklasse, Runtime und Functions-Version. DEV-Settings zeigen eindeutig auf DEV-Cosmos, den unveränderten DEV-Business-Storage und die gemeinsamen AI-/DI-/CIAM-Dienste. Der tatsächliche Resource-/GET-Nachweis bestätigt explizit `Always Ready = 0` und `Maximum Instances = 5` im verifizierten Flex-Scope. Jede Abweichung erzeugt den passenden `PLAN-ASSUMPTION-INVALID`-/`STOP`- oder `UNVERIFIED`-Befund und blockiert den weiteren Ablauf. Die separate Flex-Application-Insights-Instanz ist über eigene Resource-ID/Connection-String-Evidence von der Legacy-Y1-Telemetrie getrennt; ihr Fehlen vor WP-IR03 ist kein akzeptierter Nachweisersatz.
- **AC-7:** Die vollständige DEV-Validierung besteht mit Function List, Health 200, fehlendem/ungültigem Token HTTP 401, gültigem CIAM-Testuser, reversiblen API-/Datenflüssen, unverändertem Business-Storage, Queue-/Blob-Flows, AI/DI, Renderer, separater Flex-Telemetrie, expliziter Business-Queue-Verarbeitung und Post-Provisioning-Quota-Kontrolle auf Basis der dokumentierten Standard-Quota. Storage-Migration, Queue-Wechsel, Blob-Datenumzug und Blob-Mutation sind ausgeschlossen; eine Blob-Inventur ist nicht erforderlich. Scheduler-Registrierung und Handler-Vertrag sind geprüft.
- **AC-8:** Der von Infrastructure ausgeführte `DEV-GATE`-Handoff umfasst die vollständige DEV-Evidence, dokumentiert einen eindeutigen `PASS` oder `STOP` und blockiert jede Alpha-Mutation bei `STOP`, `UNVERIFIED`, fehlender Evidence oder unklarer Zuordnung. `DEV-GATE` ist keine QA-Stufe; QA bleibt auf das terminale Work Package beschränkt.
- **AC-9:** Alpha-Flex wird erst nach dem eindeutigen `DEV-GATE`-PASS provisioniert. Die tatsächliche Alpha-Workload-Unterstützung wird nach der Provisionierung gegen die dokumentierte Standard-Flex-Quota kontrolliert; Unterversorgung oder widersprochene Basis ist ein WA-06-STOP. Bis zum Alpha-Smoke bleiben der bestehende Y1-Stack, seine Legacy-Telemetrie und bestehende DEV-/Alpha-Business-Storage-Ressourcen unverändert; Queues, Blob-Container und Blob-Daten werden nicht verschoben, ersetzt oder migriert. Alpha verwendet ausschließlich Alpha-Datenressourcen und die separat nachgewiesene Flex-Application-Insights-Instanz.
- **AC-10:** Alpha erhält denselben Backend-Artefakt-Hash wie DEV. Der Hashvergleich, der Package-Deploy, Runtime und Function List sind dokumentiert.
- **AC-11:** Es gibt genau einen einfachen `preview-flex`-Konfigurationsschritt mit direkter Flex-URL inklusive `/api`, bestehenden öffentlichen CIAM-/Variant-/Package-Werten und ohne Secrets. Wegen der build-time eingebetteten `EXPO_PUBLIC_API_URL` wird danach verbindlich ein neuer installierbarer `preview-flex`-EAS-Build erstellt. Das Profil ist reine URL-/JS-Konfiguration; `app.config.js`, Native-Plugins, Package-IDs, Screens und Navigation bleiben unverändert. Der Build ist nicht optional und seine Build-ID wird vor dem Alpha-Smoke nachgewiesen.
- **AC-12:** Der fokussierte Alpha-Smoke besteht mit der Build-ID aus AC-11, Health 200, geschütztem 401, gültigem CIAM-Flow, reversibler Datenoperation, unverändertem Business-Storage, Control-Plane-Queue-/Blob-Container-Evidence, Blob-Read/Upload-Flow, AI-/DI-/Renderer-Flow, direktem `preview-flex`-Clientpfad, separater Flex-Application-Insights-Evidence, getrennter Legacy-Y1-Telemetrie und identischem Backend-Hash. Eine Blob-Inventur oder Data-Reader-Evidence ist kein Smoke-Gate.
- **AC-13:** Y1-Decommission findet erst nach AC-12-PASS als explizite, gezielte Aktion statt. Entfernt werden nur die alte Y1-App, ihr Plan und ausschließlich nicht mehr benötigte hostbezogene Ressourcen. Cosmos, bestehendes Business Storage, Queues, Blob-Container, Blob-Daten, CIAM, OpenAI, Document Intelligence, die separate Flex-Application-Insights-Instanz und erforderliche getrennte Telemetrie bleiben erhalten; es gibt keine Storage-Migration, keinen Queue-Wechsel, keinen Blob-Datenumzug oder Blob-Mutation.
- **AC-14:** Erst nach AC-13 werden Flex-Queue-Trigger und Flex-Timer aktiviert. Eine kontrollierte Nachricht in der bestehenden Business-Queue und ein kontrollierter Timerlauf werden je genau einmal verarbeitet; Producer und Trigger verwenden die Business-Storage-Verbindung, ohne Doppelverarbeitung, Storage-Migration, Queue-Wechsel, Blob-Datenumzug oder falsche Environment-Zuordnung.
- **AC-15:** Release-Record, `infra/README.md`, relevante Infrastrukturdokumentation und der abschließende QA-Bericht beschreiben den tatsächlich ausgeführten Zustand ohne Secrets. Sie enthalten `Always Ready = 0`, `Maximum Instances = 5` mit Scope, DEV-/Alpha-Quota-Kontroll-Evidence auf Basis der dokumentierten Standard-Quota, die getrennte Flex-/Legacy-Telemetrie, die verpflichtende `preview-flex`-Build-ID, die ausgeführte WA-15-Identitäts-/Scope-Evidence einschließlich No-Assignment-Evidence oder Assignment-Allowlist sowie Control-Plane-/What-if-/No-Mutation-Evidence für Storage, Queue und Blob-Container ohne Migration, Blob-Mutation oder Ersetzen. Ein `UNSUPPORTED`- oder blockierendes `UNVERIFIED`-Ergebnis darf nicht als ausgeführter Releasezustand dokumentiert werden; es beendet die aktuelle Planversion und verlangt eine neue Planner-Revision vor jeder Fortsetzung. `UNVERIFIED-QUOTA` im WP-IR01-Preflight und der historische `UNVERIFIED-BLOB-DATA-READER` sind dagegen keine Releasefreigabe, aber auch keine Pre-Mutation-Blockade. Notwendige KB-Änderungen sind als dokumentierte Planner-Nacharbeit nach dem ausgeführten Release ausgewiesen, nicht als Phase-2-Subtask oder Execution-Order-Eintrag. QA liefert für den vollständigen AC-Satz genau eine Kriterienmatrix und ein Verdict.
- **AC-16:** Der WP-IR01-Handoff vom 2026-09-29 bestätigt `Maximum Instances = 5` als `SUPPORTED`; `5` bleibt unverändert und wird nicht auf `40` ersetzt. Bei einer späteren `UNSUPPORTED`-Revalidierung erzeugt WP-IR01 `PLAN-ASSUMPTION-INVALID:WA-04` plus `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED`; bei einer späteren `UNVERIFIED`-Revalidierung erzeugt es `UNVERIFIED-MAXIMUM-INSTANCE-SCOPE`. Beide Ergebnisse stoppen vor Mutation und führen über das Plan Assumption Failure Protocol zu einem secretfreien Handoff an Orchestrator und Planner, einer neuen Planrevision und einer neuen `APPROVE`. Ein Default, eine alternative Architektur oder jeder andere Ersatzwert sind in dieser Ausführung verboten.
- **AC-17:** Vor der neuen `APPROVE` muss nur `PLAN-ASSUMPTION-INVALID:WA-15` durch den benannten Owner mit secretfreier Evidence aufgelöst sein: tatsächliche dedizierte Deployment-Identität, `Contributor` ausschließlich auf `rg-Michael-Mueller` und read-only Prüfung, ob geplante IaC Role Assignments erstellt. Ohne Role Assignments ist RG-scoped `Contributor` die Basis; bei Role Assignments müssen targeted Permission(s), die erforderlichen engsten Scopes und die Assignment-Allowlist bestätigt werden. Nicht read-only bestätigbare Assignment-Permission oder Scope ist `UNVERIFIED-PERMISSIONS`/`STOP`; Subscription-`Contributor`, `Owner`, breite Eskalation und RBAC-Selbstreparatur durch den Executor sind verboten. `UNVERIFIED-QUOTA` ist im WP-IR01-Preflight nicht blockierend; `UNVERIFIED-BLOB-DATA-READER` ist für diese Migration nicht erforderlich. Unter dieser Revision darf nach dieser `APPROVE` ausschließlich WP-IR01 erneut read-only ausgeführt werden. Nur ein vollständiger `PASS`-Handoff unter den revidierten Semantiken entsperrt WP-B01; kein anderes Implementierungs-, IaC-, Deployment-, EAS- oder QA-WP darf vorher starten. `STOP`- und blockierende `UNVERIFIED`-Befunde einschließlich späterer Quota-Unterversorgung, widersprochener Quota-Basis oder Wertabweichungen blockieren Mutation und führen über das Failure Protocol zum Planner. Bestehendes Business Storage, Queue `reusable-items-enrich`, Blob-Container/-Daten, Cosmos, Shared AI/DI/CIAM und Legacy-Y1-Telemetrie bleiben unverändert geschützt.

## 21. Risks and Edge Cases

| Risiko | Auswirkung | Gegenmassnahme / Stop |
|---|---|---|
| Flex-SKU, API, Region oder Node-24-Unterstützung ist nicht verfügbar | Provisionierung oder Runtime wäre nicht belastbar | WP-IR01 muss aktuelle Schema-/Region-/Runtime-Evidence und die dokumentierte Standard-Quota-Basis liefern; tatsächliche Quota-Unterstützung wird nach DEV-/Alpha-Provisionierung geprüft; fehlende subscription-spezifische Preflight-Messung ist kein STOP |
| Die tatsächliche Flex-Quota unterstützt den geplanten DEV-/Alpha-Workload nicht oder widerspricht der dokumentierten Standardbasis | Provisionierung oder Betrieb wäre nicht belastbar | WP-IR03/WP-IR05 stoppen mit `PLAN-ASSUMPTION-INVALID:WA-06` plus `STOP-FLEX-QUOTA-INSUFFICIENT` beziehungsweise `STOP-FLEX-QUOTA-BASIS-CONTRADICTED`; keine Provider-Registrierung oder Quota-Erhöhung nur für den Gate-Nachweis |
| `@minValue(40)` aus dem Microsoft-Quickstart wird als serverseitige Provider-Mindestgrenze gelesen, obwohl der Decorator nur den Bicep-Parameter validiert | `5` würde ohne belastbare Evidence verworfen oder `40` unbemerkt übernommen | WP-IR01 muss Template-Constraint, ARM-/Provider-Schema, Dienstvertrag und read-only Validierung getrennt evidenceieren; Ergebnis `SUPPORTED`, `UNSUPPORTED` oder `UNVERIFIED` |
| Die aktuelle Flex-Syntax, API-Version, Unterstützung oder der Geltungsbereich für `Always Ready = 0` beziehungsweise `Maximum Instances = 5` ist nicht belegt | IaC könnte einen ununterstützten oder falsch begrenzten Workload deployen | Read-only Preflight vor jeder Mutation; ununterstützte Darstellung oder unklarer Scope ist STOP, ohne Ersatzwert |
| `Maximum Instances = 5` wird als globales App-Limit oder pauschales Gesamtlimit der Function App interpretiert | Andere Flex-Skalierungs- oder Hostingbereiche würden unbeabsichtigt begrenzt | Resource-/Scope-Evidence im Preflight, in DEV, Alpha und Release-Record; nur das verifizierte Flex-Instance-Limit im vorgesehenen Scope zulassen |
| Flex und Legacy-Y1 verwenden dieselbe Application-Insights-Instanz oder Connection | Telemetrie wird vermischt oder Legacy-Schutz wird unklar | Dedizierte Flex-Application-Insights-Resource-ID und getrennte Legacy-Y1-Connection in IaC, Settings, Smoke, `what-if` und Release-Record erzwingen; sonst STOP |
| Package-Deployment unterscheidet sich vom bestehenden Y1-Weg | Staging, Assets oder native Module fehlen | Publishweg read-only verifizieren und vor DEV mit einem vollständigen Linux-Artefakt belegen |
| Windows-Bindings gelangen in den Produktionsbaum | Renderer fällt auf Linux aus | frische Linux-x64-Installation, Native-Gate und positiver Renderer-Smoke |
| Node-24-Manifest oder Lockfile ist inkonsistent | Build oder Runtime startet nicht | Clean Build mit allen betroffenen Typechecks und `build:verify` |
| Producer nutzt weiter Host Storage | Queue-Nachrichten erreichen die Business-Queue nicht | Unit-/statischer Binding-Test und DEV-Queue-Smoke gegen `STORAGE_CONNECTION_STRING`; kein Fallback |
| Queue-Trigger nutzt eine andere Einstellung als der Producer | Nachrichten bleiben liegen oder werden falsch verarbeitet | identische Setting-/Queue-Matrix vor DEV und nach Decommission prüfen |
| DEV oder Alpha zeigt auf die falsche Datenquelle | Datenvermischung oder falsche Testresultate | Resource-ID-, Endpoint- und kontrollierter Testuser-Nachweis je Environment |
| Eine bestehende DEV-/Alpha-Business-Storage-Ressource, Queue, Blob-Container oder Blob-Daten wird durch Flex ersetzt, verändert, verschoben oder migriert | Bestehende Business-Daten oder Queue-Verträge würden beschädigt | Host-/Business-Storage-Trennung, Resource-Allowlist und `what-if`; jede Storage-Migration, jeder Queue-Wechsel, Blob-Datenumzug oder Ersatz ist STOP |
| Scheduler und Queue-Trigger sind im falschen Zeitpunkt live | doppelte Enrichment-Verarbeitung | Scheduler-Live-Smoke erst nach Decommission und Flex-Aktivierung; vorher nur Registrierung/Handler prüfen |
| `preview-flex` enthält eine falsche URL oder `/api` fehlt | Client-Smoke erreicht die falsche Route | statische EAS-Prüfung, Build-ID und eingebettete URL vor Smoke prüfen |
| Der verpflichtende `preview-flex`-EAS-Build wird nicht erstellt oder als optional behandelt | Der Alpha-Smoke prüft nicht den build-time eingebetteten Flex-Clientpfad | WP-M01 muss an WP-IR07 übergeben; WP-IR07 liefert vor WP-IR08 eine installierbare Build-ID; sonst STOP |
| Alpha-Smoke schlägt fehl | Y1-Rückfallbetrieb wäre unklar | Decommission nicht ausführen; aus Git/IaC/Artefakt/Parametern wiederherstellen |
| Decommission löscht Shared-Ressourcen oder bestehendes Business Storage | Daten-, Auth-, Queue-, Blob-, Telemetrie- oder AI-Ausfall | gezieltes `what-if`, Resource-ID-Allowlist und Post-Check; Cosmos, Business Storage, Queues, Blob-Container/-Daten, Flex-Telemetrie und erforderliche Legacy-Telemetrie bleiben geschützt |
| Recovery-Eingaben sind nicht reproduzierbar | Wiederherstellung verzögert sich | Commit, Artefakt-Hash, IaC-Version und Parameter im Release-Record festhalten |
| Die Ausführungsidentität ist erneut `Contributor` auf Subscription-Scope, `Owner` auf irgendeinem Scope oder die Phasen-/Scope-Matrix fehlt | Sicherheitsgrenze und Planannahme wären verletzt | `PLAN-ASSUMPTION-INVALID:WA-15`; Subscription-/Cloud-Owner muss vor der Freigabe eine dedizierte phasenbezogene Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller` und secretfreie Rollen-/Scope-Evidence liefern. RG-scoped `Contributor` ist nur ohne geplante Role Assignments die ausreichende Basis; bei Assignments sind exakt erforderliche Permission(s), Scopes und Assignment-Allowlist nachzuweisen; keine breite Eskalation als Ersatz |
| Azure-, EAS- oder CIAM-Zugriff fehlt | notwendige Evidence kann nicht entstehen | Schritt als `UNVERIFIED`/STOP melden; keine Scheinfreigabe |

## 22. Stop Conditions

Der Ablauf stoppt sofort, wenn:

- Flex-Schema, Node-24-LTS-Runtime, Region oder Package-Deployment nicht aktuell verifiziert werden können;
- die dokumentierte Standard-Flex-Quota als Arbeitsbasis widersprochen ist oder WP-IR03/WP-IR05 die tatsächliche Unterstützung des geplanten Workloads nicht nachweisen können (`PLAN-ASSUMPTION-INVALID:WA-06` plus `STOP-FLEX-QUOTA-BASIS-CONTRADICTED` beziehungsweise `STOP-FLEX-QUOTA-INSUFFICIENT`); eine fehlende subscription-spezifische Preflight-Messung bleibt `UNVERIFIED-QUOTA` und ist kein Stop;
- die ausführende Identität `Contributor` auf Subscription-Scope, `Owner` auf irgendeinem Scope oder nicht phasenbezogen ist, die erforderliche Rollen-/Scope-Matrix fehlt oder die Identität nicht eindeutig nachgewiesen werden kann (`PLAN-ASSUMPTION-INVALID:WA-15` beziehungsweise `UNVERIFIED-PERMISSIONS`); RG-scoped `Contributor` ausschließlich auf `rg-Michael-Mueller` ist zulässig, eine Eskalation zur Auflösung ist verboten;
- die read-only Prüfung nicht bestätigt, ob die geplante IaC neue Role Assignments erstellt, oder bei geplanten Assignments die exakt erforderlichen Permission(s), Assignment-Scopes oder Assignment-Allowlist nicht bestätigt werden können (`UNVERIFIED-PERMISSIONS`/`STOP`); der Executor darf keine Azure-RBAC-Selbstreparatur als Workaround ausführen;
- die explizite IaC-/ARM-Darstellung von `Always Ready = 0` bestätigt nicht unterstützt ist (`PLAN-ASSUMPTION-INVALID:WA-05` plus `STOP-AR0-UNSUPPORTED`), nicht entscheidbar bleibt (`UNVERIFIED-AR0-EXPLICIT`) oder der Instance-Wert nicht eindeutig als Flex-Scope-Limit statt als globales App-/Gesamtlimit dokumentiert ist;
- WP-IR01 auf Dienst-/Provider-Ebene `maximumInstanceCount = 5` als unzulässig bestätigt (`PLAN-ASSUMPTION-INVALID:WA-04` plus `STOP-MAXIMUM-INSTANCES-5-UNSUPPORTED`), als nicht entscheidbar meldet (`UNVERIFIED-MAXIMUM-INSTANCE-SCOPE`) oder ein Folge-WP ohne das Ergebnis startet. `UNVERIFIED` darf nicht als Ablehnung und nicht als Freigabe für `40` behandelt werden;
- eine mutierende oder wertabhängige Arbeit trotz offenem WA-15-/phasenbezogenem Evidence-Gate, `STOP`-/blockierendem `UNVERIFIED`-Handoff oder ohne neue explizite `APPROVE` nach dieser Planrevision gestartet wird;
- Azure-Subscription, bestehende Resource Group oder erforderliche Berechtigungen fehlen;
- eine Blob-Inventur oder `Storage Blob Data Reader`-Evidence als Vorbedingung verlangt wird; fehlender Data Reader ist kein Stop und beweist weder fehlende Blob-Daten noch eine Migration. Tatsächliche Business-Storage-/Blob-Mutation oder Migration bleibt über WA-08 und `STOP-BUSINESS-STORAGE-MUTATION` ein harter Stop;
- `what-if` unerwartete Deletes, Datenressourcenänderungen, Shared-Resource-Änderungen, eine Änderung an bestehendem Business Storage, Queue-/Blob-Container-/Blob-Daten-Mutation, Storage-Migration, Queue-Wechsel, Blob-Datenumzug oder unklare Host-/Business-Storage-Zuordnungen zeigt. Das geplante Create einer neuen Flex-Application-Insights- oder Host-/Deployment-Storage-Ressource ist dagegen nur dann ein STOP, wenn es vom bestätigten Contract abweicht;
- nach WP-IR03 oder WP-IR05 die separate Flex-Application-Insights-Instanz nicht mit eigener Resource-ID/Connection-String-Zuordnung nachgewiesen werden kann, die Legacy-Y1-Telemetrie ersetzt/wiederverwendet wird oder erforderliche Flex-Telemetrie gelöscht werden soll;
- nach Abschluss von WP-B01 der Backend-Code die Queue noch über `AzureWebJobsStorage` auswählt oder als Fallback verwendet oder Trigger und Producer nicht dieselbe Business-Storage-Einstellung verwenden. Der im Confirmed-Facts-Abschnitt dokumentierte Ist-Zustand vor WP-B01 ist erwartete Vorbereitungsarbeit und kein eigener WP-IR01-STOP;
- Node-24-Typechecks, Tests, `build:verify`, Asset-Mirror, Encoding-/Secret-Leak-Check oder Linux-x64-Native-Gate fehlschlagen;
- das verpflichtende lokale Startup-/Smoke-Gate nach einer Manifest-/Lockfile- oder Backend-Änderung nicht vollständig PASS ist: der exakte Aufruf aus `backend/` fehlt, der Build schlägt fehl, Azurite oder `reusable-items-enrich` werden nicht bereit, Port 7071 wird nicht vom Functions-Host belegt, Health liefert nicht HTTP 200, die kontrollierte Beendigung oder die phasengenaue Fehlerdiagnose fehlt, oder lokale Settings/Emulatoren werden als Flex-Host-Storage beziehungsweise als Azure-Mutationspfad verwendet;
- DEV- oder Alpha-Datenquellen nicht eindeutig getrennt sind;
- bestehende DEV-/Alpha-Business-Storage-Ressourcen, Queues, Blob-Container oder Blob-Daten nicht unverändert referenziert werden können;
- Health nicht 200, geschützte Endpoints ohne Token nicht 401 oder gültige CIAM-Authentifizierung nicht erfolgreich ist;
- Cosmos-, Blob-, AI-, Document-Intelligence-, Renderer- oder Telemetrie-Smoke einen ungeklärten Fehler zeigt;
- der Infrastructure-verantwortete `DEV-GATE`-Handoff keinen eindeutigen PASS liefert;
- Alpha einen anderen Backend-Artefakt-Hash als DEV erhält;
- der verpflichtende `preview-flex`-EAS-Build nicht vor dem Alpha-Smoke erstellt wird, keine installierbare Build-ID liefert oder eine falsche URL, falsche öffentliche Konfiguration oder ein Secret enthält;
- der fokussierte Alpha-Smoke nicht vollständig PASS ist;
- der Decommission-Scope nicht ausschließlich Y1-Hosting umfasst oder Shared-Ressourcen, bestehendes Business Storage, Queues, Blob-Container/-Daten, die separate Flex-Telemetrie oder erforderliche Legacy-Telemetrie nicht nachweisbar geschützt sind;
- der Queue-/Timer-Smoke nach Flex-Aktivierung Doppelverarbeitung, falsche Environment-Zuordnung oder Nutzung des Host Storage als Business Storage zeigt;
- Commit, Artefakt, IaC oder Parameter für Recovery nicht eindeutig referenziert sind.

## 23. Recommended Execution Order

Die Ausführung erfolgt strikt sequenziell. Jeder Schritt muss den vollständigen Handoff und die zugehörigen Stop Conditions erfüllen, bevor der nächste Schritt beginnt.

1. **WA-15-Evidence durch den benannten Owner:** Der Subscription-/Cloud-Owner stellt die tatsächliche dedizierte phasenbezogene Deployment-Identität mit `Contributor` ausschließlich auf `rg-Michael-Mueller`, die Rollen-/Scope-Matrix und die read-only Prüfung bereit, ob die geplante IaC neue Role Assignments erstellt. Ohne Role Assignments genügt die RG-scoped-`Contributor`-Basis; bei Role Assignments sind nur die exakt erforderlichen Permission(s), Scopes und die Assignment-Allowlist zulässig. Owner-, Subscription-`Contributor`- und breite Rechte sowie RBAC-Selbstreparatur durch den Executor sind ausgeschlossen. Dieser Vorbereitungsschritt ist kein Work Package und führt keine Mutation aus; Quota- oder Blob-Reader-Evidence wird hier nicht verlangt. EAS-Berechtigung wird erst im späteren EAS-WP evidenceiert.
2. **Neue explizite `APPROVE`:** Sobald die WA-15-Evidence vollständig und secretfrei vorliegt, erteilt der Benutzer für `2026-09-29-WP-IR01-STOP-04` die neue ausdrückliche Freigabe `APPROVE`. Die frühere Freigabe ist invalidiert. Diese Freigabe autorisiert ausschließlich den folgenden read-only Preflight.
3. **Erneutes WP-IR01, Infrastructure:** Ausschließlich read-only den Flex-/Runtime-/Package-/Permission-Preflight durchführen und `PASS`, `STOP` oder `UNVERIFIED` mit Code dokumentieren. Dabei die bestätigten `SUPPORTED`-Befunde für `Maximum Instances = 5` und `Always Ready = 0` auf Drift prüfen, die dokumentierte Standard-Quota-Basis ohne erfundenen aktuellen Subscription-Wert, die Permission-Matrix, das spätere Resource-Modell für separate Flex-Application-Insights-/Host-Storage-Ressourcen sowie die Control-Plane-Business-Storage-/Queue-/Container-Referenzen und What-if-Allowlist festhalten. Zukünftige Resource-IDs, Blob-Inventur und Data-Reader-Evidence werden hier nicht verlangt.
4. **Gate-Entscheidung nach WP-IR01:** Nur ein vollständiger revised-policy `PASS` mit erfüllten blockierenden Contract-/Permission-/Scope-Prüfungen und unverändert `SUPPORTED` für `Maximum Instances = 5` sowie `Always Ready = 0` entsperrt WP-B01. `UNVERIFIED-QUOTA` darf als nicht blockierende Mess-Evidence enthalten sein; `UNVERIFIED-BLOB-DATA-READER` ist nicht erforderlich. Bei `STOP` oder einem blockierenden `UNVERIFIED` bleibt die Sequenz ohne Mutation stehen; der Owner liefert den secretfreien Handoff über das Failure Protocol an Orchestrator und Planner. `40`, ein Default, eine alternative Architektur und jeder andere Ersatzwert sind verboten. Eine weitere Planrevision benötigt erneut `APPROVE` und startet wieder bei WP-IR01.
5. **WP-B01, Backend:** Erst nach dem freigebenden Gate Node-24- und Queue-Vertrag vorbereiten; Producer und Trigger auf die explizite Business-Storage-Einstellung ausrichten, ohne Storage-Migration oder Datenverschiebung.
6. **WP-IR02, Infrastructure:** Flex-IaC, Setting-Matrix, Resource-Referenzen und Package-Releasepfad anhand der bestätigten Zielwerte vorbereiten; `Always Ready = 0` und `Maximum Instances = 5` unverändert abbilden; bestehendes Business Storage ausschließlich referenzieren.
7. **WP-B02, Backend:** Clean Build, Tests, `build:verify`, Asset-Mirror und Artefaktmanifest mit Hash liefern sowie nach dem finalen Manifest-/Lockfile- und Backend-Stand den verpflichtenden lokalen Startup-/Smoke-Gate aus `backend/` mit exakt `npm run dev`, Health-200-Nachweis und sauberer Beendigung durchführen.
8. **WP-IR03, Infrastructure:** Flex-DEV provisionieren und Runtime-/Resource-/Setting-/Telemetry-Baseline mit `Always Ready = 0` und `Maximum Instances = 5` prüfen; die Post-Provisioning-Quota-Kontrolle gegen die dokumentierte Standardbasis durchführen; bestehende DEV-Storage-Ressourcen, Queue und Blob-Container unverändert lassen und dies per Control Plane/What-if/No-Mutation-Evidence belegen.
9. **WP-IR04, Infrastructure:** Den geprüften Build deployen, die vollständige DEV-Validierung einschließlich explizitem Business-Queue-Smoke, `Always Ready = 0`, `Maximum Instances = 5`, getrennter Telemetrie, Post-Provisioning-Quota-Ergebnis und Control-Plane-Storage-Schutz ausführen und den Infrastructure-verantworteten `DEV-GATE`-Handoff mit harter PASS/STOP-Condition liefern.
10. **WP-IR05, Infrastructure:** Alpha-Flex ausschließlich nach `DEV-GATE`-PASS provisionieren, die separate Flex-Application-Insights-Instanz und Alpha-Storage-Referenzen nachweisen, die Post-Provisioning-Quota-Kontrolle gegen die dokumentierte Standardbasis durchführen, Y1 bis zum Alpha-Smoke schützen und Hintergrundfunktionen noch nicht live aktivieren.
11. **WP-IR06, Infrastructure:** Den unveränderten DEV-Artefaktstand nach Alpha deployen und den identischen Hash sowie die unveränderte Business-Storage-/Telemetry-Zuordnung nachweisen.
12. **WP-M01, Frontend:** Genau einen `preview-flex`-Konfigurationsschritt mit direkter Alpha-Flex-URL und `/api` liefern und den verbindlichen Infrastructure-Build-Handoff übergeben. Die reine URL-/JS-Konfiguration enthält keine native Änderung.
13. **WP-IR07, Infrastructure:** Den neuen `preview-flex`-EAS-Build zwingend erstellen, Build-ID und eingebettete Flex-URL nachweisen und den Build als Voraussetzung für den Smoke übergeben.
14. **WP-IR08, Infrastructure:** Den fokussierten Alpha-Smoke mit der installierbaren `preview-flex`-Build-ID ausführen; erst bei PASS mit der nächsten Phase fortfahren.
15. **WP-IR09, Infrastructure:** Erst nach Alpha-Smoke-PASS Y1 gezielt decommissionieren, ohne Business Storage, Queues, Blob-Container/-Daten oder erforderliche getrennte Telemetrie zu löschen/ersetzen, Flex-Queue-Trigger und Timer aktivieren und genau den kontrollierten Queue-/Timer-Smoke ausführen.
16. **WP-IR10, Infrastructure:** Release-Record, Recovery-Referenzen und Infrastruktur-Dokumentation einschließlich `Always Ready = 0`, `Maximum Instances = 5`, Scope-Evidence, DEV-/Alpha-Quota-Kontroll-Evidence, Telemetrie-, Build- und Control-Plane-/No-Storage-Mutation-Evidence erstellen.
17. **WP-QA-Final, QA:** Den finalen `fittrack-qa-v1`-Bericht mit vollständiger AC-1-bis-AC-17-Matrix, Scope-/Assumption-Evidence und `DEV-GATE`-Evidence erstellen.

Die Planner-KB-Aktualisierung bleibt dokumentierte Nacharbeit nach dem ausgeführten Release und ist bewusst weder ein Phase-2-Work-Package noch ein Eintrag dieser Execution Order.

**Planungsabschluss:** Bis zu einer neuen expliziten `APPROVE` und der ausgeführten Sequenz bleiben Node 24 auf Flex, die Flex-URLs, der Alpha-Deploy, das Decommission und die Dokumentationsänderungen `[Planned]`. Diese Revision ist nicht freigegeben; die frühere Zustimmung gilt nicht fort.
