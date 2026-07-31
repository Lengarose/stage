#!/usr/bin/env node
/** Regenerates nl/de commonPages from EN keys + FR semantic reference. */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packsDir = join(__dirname, '..', '..', 'src/translations/packs');
const en = JSON.parse(readFileSync(join(packsDir, 'en.commonPages.json'), 'utf8'));
const fr = JSON.parse(readFileSync(join(packsDir, 'fr.commonPages.json'), 'utf8'));

function protect(t) {
  const tok = [];
  let i = 0;
  const out = t.replace(/\{[^}]+\}/g, (m) => {
    const x = `__P${i++}__`;
    tok.push([x, m]);
    return x;
  });
  return { out, tok };
}
function rest(t, tok) {
  let o = t;
  for (const [x, m] of tok) o = o.replaceAll(x, m);
  return o;
}

const FR_NL = [
  ['Impossible de ', 'Kon niet '], ['Impossible d', 'Kon niet '], ['Tu dois ', 'Je moet '], ['Tu es ', 'Je bent '],
  ['Tu peux ', 'Je kunt '], ['Tu verras ', 'Je ziet '], ["Tu n'", 'Je '], ['Tu ne ', 'Je '], ['Ton ', 'Je '], ['Ta ', 'Je '], ['Tes ', 'Je '],
  ['Rechercher', 'Zoeken'], ['Recherche', 'Zoeken'], ['Chargement', 'Laden'], ['Enregistrement', 'Opslaan'], ['Envoi', 'Verzenden'],
  ['Supprimer', 'Verwijderen'], ['Annuler', 'Annuleren'], ['Accepter', 'Accepteren'], ['Refuser', 'Weigeren'], ['Confirmer', 'Bevestigen'],
  ['Continuer', 'Doorgaan'], ['Retour', 'Terug'], ['Suivant', 'Volgende'], ['Fermer', 'Sluiten'], ['Ouvrir', 'Openen'], ['Voir', 'Bekijken'],
  ['Créer', 'Maken'], ['Crée ', 'Maak '], ['Envoie ', 'Verstuur '], ['Partage', 'Deel'], ['Partager', 'Delen'], ['Inviter', 'Uitnodigen'],
  ['Défier', 'Uitdagen'], ['Joueurs', 'Spelers'], ['Joueur', 'Speler'], ['Matchs', 'Wedstrijden'], ['Match ', 'Wedstrijd '],
  ['Tournois', 'Toernooien'], ['Tournoi', 'Toernooi'], ['Compétitions', 'Competities'], ['Compétition', 'Competitie'], ['Ligue', 'Competitie'],
  ['Classements', 'Ranglijsten'], ['Transferts', 'Transfers'], ['Contrats', 'Contracten'], ['Contrat', 'Contract'],
  ['Notifications', 'Meldingen'], ['Paramètres', 'Instellingen'], ['Plateforme', 'Platform'], ['Région', 'Regio'], ['Pays', 'Land'],
  ['Poste', 'Positie'], ['Postes', 'Posities'], ['Buts', 'Goals'], ['Passes', 'Assists'], ['Vérifié', 'Geverifieerd'], ['Inconnu', 'Onbekend'],
  ['Gratuit', 'Gratis'], ['Officiel', 'Officieel'], ['Aucun ', 'Geen '], ['Aucune ', 'Geen '], ['Encore ', 'Nog '], ['Déjà ', 'Al '],
  ['Capitaine', 'Aanvoerder'], ['Président', 'Voorzitter'], ['Forfait', 'Forfait'], ['Contesté', 'Betwist'], ['Planifié', 'Gepland'],
  ['En attente', 'In behandeling'], ['Confirmé', 'Bevestigd'], ['Refusé', 'Geweigerd'], ['Accepté', 'Geaccepteerd'],
  ['Domicile', 'Thuis'], ['Extérieur', 'Uit'], ['Adversaire', 'Tegenstander'], ['Résultat', 'Uitslag'], ['Vestiaire', 'Kleedkamer'],
  ['Calendrier', 'Kalender'], ['Mon club', 'Mijn club'], ['Mon profil', 'Mijn profiel'], ['Mes clubs', 'Mijn clubs'], ['Mes ', 'Mijn '],
  ['Mon ', 'Mijn '], ['Ma ', 'Mijn '], ['Trouve ', 'Vind '], ['Essaie ', 'Probeer '], ['Clique ', 'Klik '], ['Sélectionne ', 'Selecteer '],
  ['Choisis ', 'Kies '], ['Agent libre', 'Vrije speler'], ['agents libres', 'vrije spelers'], ['Sous contrat', 'Onder contract'],
  ['Valeur marché', 'Marktwaarde'], ['Conférence de presse', 'Persconferentie'], ['Bon retour', 'Welkom terug'], ['Bienvenue', 'Welkom'],
  ['Action irréversible', 'Dit kan niet ongedaan worden gemaakt'], ['Réessaie', 'Probeer opnieuw'],
  [' pour ', ' voor '], [' avec ', ' met '], [' dans ', ' in '], [' sur ', ' op '], [' de ', ' van '], [' et ', ' en '], [' ou ', ' of '],
  [' pas ', ' niet '], [' plus ', ' meer '], [' que ', ' dat '], [' qui ', ' die '], [' cette ', ' dit '], [' ce ', ' dit '],
  [' tous ', ' alle '], [' toutes ', ' alle '], [' tout ', ' alles '], [' un ', ' een '], [' une ', ' een '], [' le ', ' de '], [' la ', ' de '], [' les ', ' de '],
];
const FR_DE = [
  ['Impossible de ', 'Konnte nicht '], ['Impossible d', 'Konnte nicht '], ['Tu dois ', 'Du musst '], ['Tu es ', 'Du bist '],
  ['Tu peux ', 'Du kannst '], ['Tu verras ', 'Du siehst '], ["Tu n'", 'Du '], ['Tu ne ', 'Du '], ['Ton ', 'Dein '], ['Ta ', 'Deine '], ['Tes ', 'Deine '],
  ['Rechercher', 'Suchen'], ['Recherche', 'Suche'], ['Chargement', 'Laden'], ['Enregistrement', 'Speichern'], ['Envoi', 'Senden'],
  ['Supprimer', 'Löschen'], ['Annuler', 'Abbrechen'], ['Accepter', 'Annehmen'], ['Refuser', 'Ablehnen'], ['Confirmer', 'Bestätigen'],
  ['Continuer', 'Weiter'], ['Retour', 'Zurück'], ['Suivant', 'Weiter'], ['Fermer', 'Schließen'], ['Ouvrir', 'Öffnen'], ['Voir', 'Ansehen'],
  ['Créer', 'Erstellen'], ['Crée ', 'Erstelle '], ['Envoie ', 'Sende '], ['Partage', 'Teile'], ['Partager', 'Teilen'], ['Inviter', 'Einladen'],
  ['Défier', 'Herausfordern'], ['Joueurs', 'Spieler'], ['Joueur', 'Spieler'], ['Matchs', 'Spiele'], ['Match ', 'Spiel '],
  ['Tournois', 'Turniere'], ['Tournoi', 'Turnier'], ['Compétitions', 'Wettbewerbe'], ['Compétition', 'Wettbewerb'], ['Ligue', 'Liga'],
  ['Classements', 'Rankings'], ['Transferts', 'Transfers'], ['Contrats', 'Verträge'], ['Contrat', 'Vertrag'],
  ['Notifications', 'Benachrichtigungen'], ['Paramètres', 'Einstellungen'], ['Plateforme', 'Plattform'], ['Région', 'Region'], ['Pays', 'Land'],
  ['Poste', 'Position'], ['Postes', 'Positionen'], ['Buts', 'Tore'], ['Passes', 'Assists'], ['Vérifié', 'Verifiziert'], ['Inconnu', 'Unbekannt'],
  ['Gratuit', 'Kostenlos'], ['Officiel', 'Offiziell'], ['Aucun ', 'Kein '], ['Aucune ', 'Keine '], ['Encore ', 'Noch '], ['Déjà ', 'Bereits '],
  ['Capitaine', 'Kapitän'], ['Président', 'Präsident'], ['Forfait', 'Forfait'], ['Contesté', 'Strittig'], ['Planifié', 'Geplant'],
  ['En attente', 'Ausstehend'], ['Confirmé', 'Bestätigt'], ['Refusé', 'Abgelehnt'], ['Accepté', 'Akzeptiert'],
  ['Domicile', 'Heim'], ['Extérieur', 'Auswärts'], ['Adversaire', 'Gegner'], ['Résultat', 'Ergebnis'], ['Vestiaire', 'Kabine'],
  ['Calendrier', 'Kalender'], ['Mon club', 'Mein Club'], ['Mon profil', 'Mein Profil'], ['Mes clubs', 'Meine Clubs'], ['Mes ', 'Meine '],
  ['Mon ', 'Mein '], ['Ma ', 'Meine '], ['Trouve ', 'Finde '], ['Essaie ', 'Versuche '], ['Clique ', 'Klicke '], ['Sélectionne ', 'Wähle '],
  ['Choisis ', 'Wähle '], ['Agent libre', 'Freier Spieler'], ['agents libres', 'freie Spieler'], ['Sous contrat', 'Unter Vertrag'],
  ['Valeur marché', 'Marktwert'], ['Conférence de presse', 'Pressekonferenz'], ['Bon retour', 'Willkommen zurück'], ['Bienvenue', 'Willkommen'],
  ['Action irréversible', 'Das kann nicht rückgängig gemacht werden'], ['Réessaie', 'Versuche erneut'],
  [' pour ', ' für '], [' avec ', ' mit '], [' dans ', ' in '], [' sur ', ' auf '], [' de ', ' von '], [' et ', ' und '], [' ou ', ' oder '],
  [' pas ', ' nicht '], [' plus ', ' mehr '], [' que ', ' dass '], [' qui ', ' die '], [' cette ', ' dieses '], [' ce ', ' dieses '],
  [' tous ', ' alle '], [' toutes ', ' alle '], [' tout ', ' alles '], [' un ', ' ein '], [' une ', ' eine '], [' le ', ' der '], [' la ', ' die '], [' les ', ' die '],
];
FR_NL.sort((a, b) => b[0].length - a[0].length);
FR_DE.sort((a, b) => b[0].length - a[0].length);

function applyFr(text, pairs) {
  const { out, tok } = protect(text);
  let r = out;
  for (const [a, b] of pairs) r = r.split(a).join(b);
  return rest(r, tok);
}

const nl = {};
const de = {};
for (const key of Object.keys(en)) {
  const e = en[key];
  const f = fr[key];
  if (f !== e) {
    nl[key] = applyFr(f, FR_NL);
    de[key] = applyFr(f, FR_DE);
  } else {
    nl[key] = e;
    de[key] = e;
  }
}

writeFileSync(join(packsDir, 'nl.commonPages.json'), JSON.stringify(nl, null, 2) + '\n');
writeFileSync(join(packsDir, 'de.commonPages.json'), JSON.stringify(de, null, 2) + '\n');
console.log('Wrote nl.commonPages.json and de.commonPages.json');
