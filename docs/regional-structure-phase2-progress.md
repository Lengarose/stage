# Fase 2 — lokale voortgang, 2 november 2026

Fase 2 is in uitvoering. Dit document beschrijft de eerste bouwstap en is geen
verklaring dat de volledige fase of productie gereed is.

**Latere bouwstap op dezelfde datum:** opgeslagen cycli, de officiële
uitslagkoppeling en Admin-bediening zijn inmiddels lokaal toegevoegd. Zie
[Regionale cycli — bediening en overdracht](regional-cycle-phase2.md) voor de
actuele status. De onderstaande open lijst beschrijft de eerdere bouwstap.

## Gebouwd

- Versie `regional_structure_v1`: expliciete structuren voor 20, 40, 60, 80, 100,
  120, 180 en 240 clubs; twintig clubs per groep.
- Pure berekening van eerste plaatsing t/m 120, normale promotie/degradatie en
  alle zeven goedgekeurde uitbreidingsroutes. Geen directe start op 180/240,
  krimp of niet-goedgekeurde tussenstructuur.
- Veertigclubsplaatsing: tachtig groepsduels plus vier beslissingsduels, twintig
  unieke clubs per divisie. Dezelfde opgeslagen seed levert dezelfde koppeling
  en thuisverdeling op. De server moet de seed nog duurzaam vastleggen.
- Normale D2-route: kampioen en play-offwinnaar; 2–5, 3–4 en finale, hoger
  geëindigde thuis. Bevestigde uitslagen bepalen de pure berekening; betwistingen,
  ontbrekende uitslagen en beslissende gelijkheid geven geen definitieve rechten.
- Groepsidentiteit binnen dezelfde permanente divisie, eigen huidige editie per
  groep, behoud oude A-hashes, rollover, resetreeksen en trofee-defaults.
- Admin leest de vlakke groepscatalogus; regionale overzichts- en detailpagina’s
  benoemen groepen. Oude permanente ID-route opent A, groepsroute opent de
  betreffende groep; expliciete historische links blijven beschikbaar.
- Gewone aanmaak mag geen nieuwe permanente B-root of clientpointers fabriceren.

## Nog nodig voor de volledige fase

1. Transactionele regionale cyclusactie met preview, opgeslagen loting/beleids-
   snapshot, broncontrole, audit, retries en definitieve groepstoewijzing.
2. Plaatsings-, promotie- en uitbreidingsduels aanmaken via de officiële engine;
   bevestigde uitslagen opnieuw uit de database lezen en vervolgrondes verwerken.
3. Oude één-op-één-promotie vervangen voor beheerde regionale cycli, zodat zij
   niet naast de nieuwe groepsroute verkeerde rechten schrijft.
4. Beslissende gelijkheden koppelen aan echte beslissingsduels/minitoernooien.
   De pure berekening stopt hiervoor momenteel met een reviewstatus.
5. Admin-bediening voor cyclusplanning en toepassing; groepsprovisioning,
   withdrawal-/concurrentie-/rollbacktests en desktop-/mobiele UI-controle.
6. Kalenderhaalbaarheid vóór activering, met name de extra vijf wedstrijden bij
   180 → 240. Fase 3-inschrijving/Plus en fase 6-duurzame orkestratie volgen later.

Geen nieuwe productiegroepen, live-ID-reparaties, wedstrijden, rechten,
kwalificaties, betalingen of awards zijn door deze lokale bouwstap aangemaakt.
GOST en D3 blijven gesloten. Er is nog geen echte MySQL/JWT-verificatie uitgevoerd.

## Controle van deze bouwstap

- 73 gerichte tests slagen: groepsidentiteit, sportieve berekeningen, normale
  promotie, alle uitbreidingen, rollover, reset, bestaande competition-engine-
  regressies, publieke routes en bestaande lokale HTTP-endpoints.
- Lint, typecheck en backend-syntaxcontrole slagen. Frontendproductiebouw slaagt;
  bestaande waarschuwingen betreffen chunkgrootte en verouderde browserdata.
- Geen nieuwe API-endpoints toegevoegd. De HTTP-tests gebruiken geïsoleerde
  databasefixtures en een geïnjecteerde testidentiteit, geen echte MySQL/JWT.
- Graphify-update geprobeerd; `graphify` is niet geïnstalleerd.
- Geen browsercontrole van de nieuwe groepslabels uitgevoerd. De uitgebreidere
  desktop-/mobiele controle staat bij de nog te bouwen cyclusbediening.
