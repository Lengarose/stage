# Regionale parallelle groepen binnen de permanente divisie

Status: gekozen opslagmodel; lokale implementatie in fase 2.

Een permanente regionale league blijft de divisie vertegenwoordigen. Maak voor
D1B geen tweede permanente D1-league aan. De historische oorspronkelijke league
en haar IDs blijven behouden; alle groepsedities verwijzen naar dezelfde
`permanent_league_id`.

`group_code` onderscheidt A/B/etc. Ontbrekend betekent groep A. De bestaande
editiehash van A blijft bytegelijk; andere groepen voegen hun groepscode aan de
hash toe. Daardoor blijven de unieke editie-indexen en oude links bruikbaar.

De root bewaart `group_current_edition_ids`. `current_edition_id` blijft voor
compatibiliteit naar A wijzen. Het beheercatalogusantwoord behoudt één
`definitions`-record en één `leagues`-record per permanente divisie en voegt een
vlakke `groups`-lijst toe. Groepsedities hebben eigen stabiele routes en archief.
Trofee-defaults en de rewardbron blijven bij de oorspronkelijke permanente
divisie; historische snapshots blijven bij hun oorspronkelijke editie.

Een reset maakt voor iedere bestaande groep een nieuwe Season 1 in een nieuwe
resetreeks. Een rollover wijzigt alleen de pointer van de betrokken groep. De
gewone CRUD-/permanente-aanmaakroute mag geen parallelle roots of door de client
ingestelde groeps-/cycluspointers aanmaken.

De groepsletter is geen seizoensnummer en geen sportief niveau. De daaropvolgende
integratiestap bewaart `regional_cycle` als gecontroleerde businesssnapshot in
dezelfde flexibele store, zonder generieke client-CRUD. Een serverseed, versie,
bronbewijs, fixtureverwijzingen en definitieve rechten horen bij die cyclus.
`competition_instances` en `competition_fixtures` bewaren de officiële duels met
brontypes `regional_cycle` en `regional_pathway`; de bestaande `matches`-uitslagflow
verwerkt de resultaten. Het opslagmodel alleen activeert geen promotie.
