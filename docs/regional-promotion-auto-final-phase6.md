# Automatische promotiefinale — 3 november 2026

Deze lokale vervolgstap sluit de goedgekeurde finaleplanning aan op het
[regionale cyclusherstel](regional-cycle-recovery-phase6.md). Er zijn geen nieuwe
speeldagen, uren, deelnemers of sportieve rechten gekozen.

## Werking

1. Admin publiceert de halve finales via de bestaande gecontroleerde
   **Promotion calendar**-actie bij een opgeslagen regionale overgangscyclus.
2. De normale herstelworker herleest de cyclus, officiële resultaten en loting.
   Die cyclusactie maakt de finale met echte deelnemers aan wanneer de sportieve
   uitkomst dat toestaat.
3. De interne finaleplanner controleert de gepubliceerde halvefinalekalender,
   bronkalender, beleidsversie, Match-identiteiten en ongewijzigde aftrappen.
4. Alleen na expliciet definitieve halvefinaleresultaten publiceert hij de finale
   op **donderdag van speelweek 11 om 20.00 uur, Europe/Brussels**, met een blok
   van zestig minuten. De bestaande clubbelasting- en conflictcontroles gelden.
5. Match, enginefixture, audits, meldingen en kalenderrecord worden samen
   transactioneel opgeslagen. Herhaling hergebruikt dezelfde kalenderidentiteit.

Zonder gepubliceerde halvefinalekalender blijft deze automatische route uit.
De job plant geen eerste halve finales, andere plaatsingsduels of nieuwe seizoenen.
Een uitsluitend door verlopen bevestigingstijd verkregen uitslag is onvoldoende
voor automatische finaleplanning. Onbesliste scores blijven wachten op de
bestaande officiële resultaat-/beslissingsprocedure.

## Blokkades en bewijs

Bij gewijzigde bronnen, tegenstanders of halvefinaletijden, onbesliste sportieve
kwesties, ontbrekende officiële Match-koppelingen, kalenderconflicten of een
verstreken finaletijd wordt niets doorgedrukt. Er wordt geen vervangende tijd gekozen.
Een gewijzigde sleutelvolgorde van hetzelfde JSON-beleid is geen beleidswijziging.

Automatisch gepubliceerde finales bewaren `publication_mode: automatic_followup`
en een verwijzing naar de oorspronkelijke halvefinalekalender. De audit heeft
een systeemactor en een vaste reden; er wordt geen Admin-identiteit verzonnen.
De publieke HTTP-actie blijft Admin-only. Een bodyveld `automatic` kan de interne
route niet activeren of de bestaande preview-/revisiecontrole omzeilen.

## Vindplaatsen

- **Admin → Regional Leagues → opgeslagen cyclus → Promotion calendar** bevat
  de Engelse uitleg en kan de gepubliceerde finale via de bestaande actie herlezen.
- **Regional action overview** toont een herstelblokkade wanneer controle nodig is.
- De finale gebruikt de bestaande **GameDay**-link en regionale kalender.

Groepsindeling toepassen, eerste kalenderpublicaties en kalenderuitzonderingen
blijven de bestaande gecontroleerde acties. GOST en D3 worden niet geactiveerd.

## Verificatie

304 geselecteerde regressietests slagen, inclusief de lokale HTTP-route. Na de
laatste aanscherping slagen negentien gerichte planner-/hersteltests opnieuw.
Deze controleren bevestigde resultaten, wachttijd, dubbele verwerking, gekoppelde
worker, gewijzigd beleid/tijden/tegenstanders, JSON-volgorde, conflicten, cutoff,
bronwijzigingen, rollback bij een mislukte melding en HTTP-autorisatie.

Lint, typecheck, backendsyntax en frontendbuild zijn geslaagd. De twee eerder
gedocumenteerde functionsController-baselinegevallen blijven buiten de selectie.
Echte MySQL/JWT, browserbediening en productie zijn niet geverifieerd.
Niets is gepusht, gedeployed of op productie uitgevoerd. Graphify bijwerken is
geprobeerd; de CLI ontbreekt.
