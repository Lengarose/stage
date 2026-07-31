#!/usr/bin/env node
/**
 * Builds es/pt/it commonPages.json from EN keys + FR reference translations.
 * Primary path: FR → target (Romance language conversion)
 * Fallback: EN → target for keys where FR === EN
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS = path.join(__dirname, '../src/translations/packs');

const en = JSON.parse(fs.readFileSync(path.join(PACKS, 'en.commonPages.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(PACKS, 'fr.commonPages.json'), 'utf8'));

const KEEP_AS_IS = new Set([
  'STAGE', 'STC', 'Discord', 'Twitch', 'Kick', 'Google', 'Outlook', 'EA FC', 'OVR', 'FAQ',
  'EA ID', 'PSN', 'Xbox', 'UCL', 'SL', 'MoM', 'GP', 'CS', 'WR', 'PTS', 'DELETE', 'Community',
  'Lifestyle', 'Operations', 'Arrange Game', 'Match Day', 'Pro Club', 'Ultimate Team',
  'Game Day', 'Live Matches', 'Press Room', 'Follow Back', 'Feed', 'Inbox', 'News', 'Stats',
  'Chat', 'Avatar', 'Gamertag', 'Bio', 'OVR', 'EA FC', 'PvP', 'MOTM', 'N/A', 'TBD', 'vs',
  'LIVE DARK', 'LIVE WHITE', 'By STAGE', 'Swiss UCL', 'Cross-Platform', 'Cross-plateforme',
  'Starter', 'Premium', 'Iconic Arena', 'Double Elim.', 'Double élim.', 'Double elim.',
]);

function protectTokens(text) {
  const store = {};
  let i = 0;
  let out = text.replace(/\{[^}]+\}/g, (m) => {
    const k = `§PH${i++}§`;
    store[k] = m;
    return k;
  });
  out = out.replace(/§PH\d+§|\b[\w][\w .+\-/éèêëàâäùûüôöîïç'&]{0,40}\b/g, (m) => {
    if (m.startsWith('§PH')) return m;
    if (KEEP_AS_IS.has(m)) {
      const k = `§BR${i++}§`;
      store[k] = m;
      return k;
    }
    return m;
  });
  return { out, store };
}

function restoreTokens(text, store) {
  let r = text;
  for (const [k, v] of Object.entries(store)) r = r.split(k).join(v);
  return r;
}

function applyRules(text, rules) {
  let out = text;
  for (const [from, to] of rules) out = out.split(from).join(to);
  return out;
}

// FR → ES (comprehensive football UI)
const FR_ES = [
  ['Aucun', 'Ningún'], ['Aucune', 'Ninguna'], ['aucun', 'ningún'], ['aucune', 'ninguna'],
  ['Trouve', 'Encuentra'], ['trouve', 'encuentra'], ['Trouver', 'Encontrar'], ['Rechercher', 'Buscar'],
  ['Recherche', 'Buscar'], ['recherche', 'búsqueda'], ['joueur', 'jugador'], ['joueurs', 'jugadores'],
  ['Joueur', 'Jugador'], ['Joueurs', 'Jugadores'], ['club', 'club'], ['clubs', 'clubes'],
  ['Club', 'Club'], ['Clubs', 'Clubes'], ['match', 'partido'], ['matchs', 'partidos'],
  ['Match', 'Partido'], ['Matchs', 'Partidos'], ['tournoi', 'torneo'], ['tournois', 'torneos'],
  ['Tournoi', 'Torneo'], ['Tournois', 'Torneos'], ['ligue', 'liga'], ['Ligue', 'Liga'],
  ['compétition', 'competición'], ['Compétition', 'Competición'], ['compétitions', 'competiciones'],
  ['Compétitions', 'Competiciones'], ['saison', 'temporada'], ['Saison', 'Temporada'],
  ['contrat', 'contrato'], ['Contrat', 'Contrato'], ['contrats', 'contratos'], ['Contrats', 'Contratos'],
  ['transfert', 'fichaje'], ['Transfert', 'Fichaje'], ['transferts', 'fichajes'], ['Transferts', 'Fichajes'],
  ['Tu ', 'Tu '], ['tu ', 'tu '], ['Ton ', 'Tu '], ['ton ', 'tu '], ['Ta ', 'Tu '], ['ta ', 'tu '],
  ['Tes ', 'Tus '], ['tes ', 'tus '], ['Te ', 'Te '], ['te ', 'te '],
  ['Es-tu sûr', '¿Seguro que quieres'], ['Es-tu ', '¿Estás '], ['Es-ce que ', '¿'],
  ['Impossible de', 'No se pudo'], ['Impossible d', 'No se pudo '], ['Impossible ', 'Imposible '],
  ['Choisis', 'Elige'], ['choisis', 'elige'], ['Choix', 'Elección'], ['Sélectionne', 'Selecciona'],
  ['sélectionne', 'selecciona'], ['Sélectionner', 'Seleccionar'], ['Envoyer', 'Enviar'],
  ['envoyer', 'enviar'], ['Envoyé', 'Enviado'], ['Envoi', 'Envío'], ['Envoie', 'Envía'],
  ['Enregistrer', 'Guardar'], ['enregistrer', 'guardar'], ['Enregistrement', 'Guardado'],
  ['Supprimer', 'Eliminar'], ['supprimer', 'eliminar'], ['Suppression', 'Eliminación'],
  ['Annuler', 'Cancelar'], ['annuler', 'cancelar'], ['Retour', 'Volver'], ['retour', 'volver'],
  ['Suivant', 'Siguiente'], ['suivant', 'siguiente'], ['Continuer', 'Continuar'],
  ['Passer', 'Omitir'], ['passer', 'omitiar'], ['Créer', 'Crear'], ['créer', 'crear'],
  ['Création', 'Creación'], ['Modifier', 'Editar'], ['modifier', 'editar'],
  ['Voir', 'Ver'], ['voir', 'ver'], ['Ouvrir', 'Abrir'], ['ouvrir', 'abrir'],
  ['Fermer', 'Cerrar'], ['fermer', 'cerrar'], ['Accepter', 'Aceptar'], ['accepter', 'aceptar'],
  ['Refuser', 'Rechazar'], ['refuser', 'rechazar'], ['Confirmer', 'Confirmar'], ['confirmer', 'confirmar'],
  ['Chargement', 'Cargando'], ['Chargement…', 'Cargando…'], ['Chargement...', 'Cargando...'],
  ['Enregistrement…', 'Guardando…'], ['Enregistrement...', 'Guardando...'],
  ['Envoi…', 'Enviando…'], ['Envoi...', 'Enviando...'], ['Création…', 'Creando…'],
  ['Voter', 'Votar'], ['voter', 'votar'], ['Inscription', 'Inscripción'], ['inscription', 'inscripción'],
  ['Inscris', 'Inscribe'], ['inscris', 'inscribe'], ['Inscrit', 'Inscrito'], ['inscrit', 'inscrito'],
  ['Postuler', 'Solicitar'], ['postuler', 'solicitar'], ['Postulé', 'Solicitado'],
  ['Approuvé', 'Aprobado'], ['Refusé', 'Rechazado'], ['En attente', 'Pendiente'],
  ['Planifié', 'Programado'], ['Programmé', 'Programado'], ['Confirmé', 'Confirmado'],
  ['Contesté', 'Disputado'], ['Forfait', 'Walkover'], ['À définir', 'Por definir'],
  ['Inconnu', 'Desconocido'], ['inconnu', 'desconocido'], ['Optionnel', 'Opcional'],
  ['optionnel', 'opcional'], ['Requis', 'Obligatorio'], ['requis', 'obligatorio'],
  ['Gratuit', 'Gratis'], ['gratuit', 'gratis'], ['Complet', 'Completo'], ['complet', 'completo'],
  ['Ouvert', 'Abierto'], ['ouvert', 'abierto'], ['Terminé', 'Finalizado'], ['terminé', 'finalizado'],
  ['Domicile', 'Local'], ['domicile', 'local'], ['Extérieur', 'Visitante'], ['extérieur', 'visitante'],
  ['Équipe', 'Equipo'], ['équipe', 'equipo'], ['Équipes', 'Equipos'], ['équipes', 'equipos'],
  ['Résultat', 'Resultado'], ['résultat', 'resultado'], ['Résultats', 'Resultados'],
  ['Classement', 'Clasificación'], ['classement', 'clasificación'], ['Classements', 'Clasificaciones'],
  ['Profil', 'Perfil'], ['profil', 'perfil'], ['Paramètres', 'Ajustes'], ['paramètres', 'ajustes'],
  ['Boutique', 'Tienda'], ['boutique', 'tienda'], ['Crédits', 'Créditos'], ['crédits', 'créditos'],
  ['Plateforme', 'Plataforma'], ['plateforme', 'plataforma'], ['Région', 'Región'], ['région', 'región'],
  ['Pays', 'País'], ['pays', 'país'], ['Poste', 'Posición'], ['poste', 'posición'],
  ['Buts', 'Goles'], ['buts', 'goles'], ['Passes', 'Asistencias'], ['passes', 'asistencias'],
  ['Note', 'Valoración'], ['note', 'valoración'], ['Notes', 'Notas'], ['notes', 'notas'],
  ['Trophée', 'Trofeo'], ['trophée', 'trofeo'], ['Trophées', 'Trofeos'], ['trophées', 'trofeos'],
  ['Vainqueur', 'Ganador'], ['vainqueur', 'ganador'], ['Champion', 'Campeón'], ['champion', 'campeón'],
  ['Finale', 'Final'], ['finale', 'final'], ['Tour', 'Ronda'], ['tour', 'ronda'],
  ['Journée', 'Jornada'], ['journée', 'jornada'], ['Nul', 'Empate'], ['nul', 'empate'],
  ['Nuls', 'Empates'], ['Victoire', 'Victoria'], ['victoire', 'victoria'], ['Défaite', 'Derrota'],
  ['défaite', 'derrota'], ['Inviter', 'Invitar'], ['inviter', 'invitar'], ['Défier', 'Desafiar'],
  ['défier', 'desafiar'], ['Message', 'Mensaje'], ['message', 'mensaje'], ['Messages', 'Mensajes'],
  ['Annonce', 'Anuncio'], ['annonce', 'annuncio'], ['Annonces', 'Anuncios'],
  ['Notification', 'Notificación'], ['notification', 'notificación'], ['Notifications', 'Notificaciones'],
  ['Communauté', 'Comunidad'], ['communauté', 'comunidad'], ['Recrutement', 'Reclutamiento'],
  ['agent libre', 'agente libre'], ['agents libres', 'agentes libres'], ['Agent libre', 'Agente libre'],
  ['Agents libres', 'Agentes libres'], ['Marché', 'Mercado'], ['marché', 'mercado'],
  ['Salaire', 'Salario'], ['salaire', 'salario'], ['Prime', 'Prima'], ['prime', 'prima'],
  ['Budget', 'Presupuesto'], ['budget', 'presupuesto'], ['Finances', 'Finanzas'], ['finances', 'finanzas'],
  ['Stade', 'Estadio'], ['stade', 'estadio'], ['Maillots', 'Camisetas'], ['maillots', 'camisetas'],
  ['Historique', 'Historial'], ['historique', 'historial'], ['Calendrier', 'Calendario'],
  ['calendrier', 'calendario'], ['Vestiaire', 'Vestuario'], ['vestiaire', 'vestuario'],
  ['Stream', 'Stream'], ['stream', 'stream'], ['Regarder', 'Ver'], ['regarder', 'ver'],
  ['Importer', 'Subir'], ['importer', 'subir'], ['Télécharger', 'Descargar'], ['télécharger', 'descargar'],
  ['Rejoindre', 'Unirse'], ['rejoindre', 'unirse'], ['Quitter', 'Salir'], ['quitter', 'salir'],
  ['Suivre', 'Seguir'], ['suivre', 'seguir'], ['Ne plus suivre', 'Dejar de seguir'],
  ['Publier', 'Publicar'], ['publier', 'publicar'], ['Publication', 'Publicación'],
  ['Partager', 'Compartir'], ['partager', 'compartir'], ['Actualiser', 'Actualizar'],
  ['Réessayer', 'Reintentar'], ['réessayer', 'reintentar'], ['Commencer', 'Empezar'],
  ['Se connecter', 'Iniciar sesión'], ['Déconnexion', 'Cerrar sesión'], ['Déconnecter', 'Cerrar sesión'],
  ['Président', 'Presidente'], ['président', 'presidente'], ['Capitaine', 'Capitán'], ['capitaine', 'capitán'],
  ['Membre', 'Miembro'], ['membre', 'miembro'], ['Membres', 'Miembros'], ['membres', 'miembros'],
  ['Effectif', 'Plantilla'], ['effectif', 'plantilla'], ['Disponibilité', 'Disponibilidad'],
  ['disponibilité', 'disponibilidad'], ['Description', 'Descripción'], ['description', 'descripción'],
  ['Nom', 'Nombre'], ['nom', 'nombre'], ['Titre', 'Título'], ['titre', 'título'],
  ['Logo', 'Logo'], ['Bannière', 'Banner'], ['bannière', 'banner'], ['Photo', 'Foto'], ['photo', 'foto'],
  ['Image', 'Imagen'], ['image', 'imagen'], ['Vidéo', 'Vídeo'], ['vidéo', 'vídeo'],
  ['Article', 'Artículo'], ['article', 'artículo'], ['Conférence de presse', 'Rueda de prensa'],
  ['Salle presse', 'Sala de prensa'], ['Récompense', 'Recompensa'], ['récompense', 'recompensa'],
  ['Récompenses', 'Recompensas'], ['Prix', 'Premio'], ['prix', 'premio'], ['Entrée', 'Entrada'],
  ['entrée', 'entrada'], ['Frais d', 'Tarifa de '], ['Coût', 'Coste'], ['coût', 'coste'],
  ['Cagnotte', 'Bote de premios'], ['cagnotte', 'bote de premios'], ['Règles', 'Reglas'], ['règles', 'reglas'],
  ['Officiel', 'Oficial'], ['officiel', 'oficial'], ['Officielle', 'Oficial'], ['Vérifié', 'Verificado'],
  ['vérifié', 'verificado'], ['Global', 'Global'], ['global', 'global'], ['Régional', 'Regional'],
  ['régional', 'regional'], ['Tous', 'Todos'], ['tous', 'todos'], ['Toutes', 'Todas'], ['toutes', 'todas'],
  ['Tout', 'Todo'], ['tout', 'todo'], ['Aucun résultat', 'Sin resultados'], ['Aucune ', 'Ninguna '],
  ['trouvé', 'encontrado'], ['trouvée', 'encontrada'], ['trouvés', 'encontrados'], ['trouvées', 'encontradas'],
  ['introuvable', 'no encontrado'], ['Introuvable', 'No encontrado'], ['pas encore', 'aún no'],
  ['Pas encore', 'Aún no'], ['pour le moment', 'por ahora'], ['Pour le moment', 'Por ahora'],
  ['maintenant', 'ahora'], ['Maintenant', 'Ahora'], ['aujourd', 'hoy'], ["Aujourd'hui", 'Hoy'],
  ['demain', 'mañana'], ['Demain', 'Mañana'], ['jours', 'días'], ['Jours', 'Días'],
  ['jour', 'día'], ['Jour', 'Día'], ['semaine', 'semana'], ['Semaine', 'Semana'],
  ['semaines', 'semanas'], ['mois', 'mes'], ['Mois', 'Mes'], ['an', 'año'], ['Annuel', 'Anual'],
  ['annuel', 'anual'], ['Mensuel', 'Mensuel'], ['mensuel', 'mensual'], ['hebdomadaire', 'semanal'],
  ['Hebdomadaire', 'Semanal'], ['par semaine', 'por semana'], ['par mois', 'por mes'],
  ['Action irréversible', 'Acción irreversible'], ['Action impossible', 'Acción fallida'],
  ['Réessaie', 'Inténtalo de nuevo'], ['réessaie', 'inténtalo de nuevo'],
  ['Merci d', 'Por favor '], ['merci d', 'por favor '], ['S\'abonner', 'Suscribirse'],
  ['Abonnements', 'Suscripciones'], ['Acheter', 'Comprar'], ['acheter', 'comprar'],
  ['Offre', 'Oferta'], ['offre', 'oferta'], ['Offre actuelle', 'Plan actual'],
  ['Compte gratuit', 'Cuenta gratuita'], ['Propriétaire', 'Propietario'], ['propriétaire', 'propietario'],
  ['Propriétaire de club', 'Propietario de club'], ['Capitanat', 'Capitanía'],
  ['Indemnité de transfert', 'Tarifa de fichaje'], ['Mercato', 'Ventana de fichajes'],
  ['mercato', 'ventana de fichajes'], ['Fenêtre de transfert', 'Ventana de fichajes'],
  ['Valeur marché', 'Valor de mercado'], ['valeur marché', 'valor de mercado'],
  ['Forme récente', 'Forma reciente'], ['Bilan', 'Balance'], ['bilan', 'balance'],
  ['Titres', 'Títulos'], ['titres', 'títulos'], ['Statistiques', 'Estadísticas'], ['statistiques', 'estadísticas'],
  ['Stats', 'Estadísticas'], ['Carrière', 'Carrera'], ['carrière', 'carrera'],
  ['Essai', 'Prueba'], ['essai', 'prueba'], ['Demande d', 'Solicitud de '], ['demande d', 'solicitud de '],
  ['Demande', 'Solicitud'], ['demande', 'solicitud'], ['Litige', 'Disputa'], ['litige', 'disputa'],
  ['Litiges', 'Disputas'], ['litiges', 'disputas'], ['Réclamation', 'Reclamación'],
  ['réclamation', 'reclamación'], ['Résoudre', 'Resolver'], ['résoudre', 'resolver'],
  ['Approuver', 'Aprobar'], ['approuver', 'aprobar'], ['Examiner', 'Revisar'], ['examiner', 'revisar'],
  ['Admin', 'Admin'], ['admin', 'admin'], ['Étape', 'Paso'], ['étape', 'paso'],
  ['sur', 'de'], ['Sur', 'De'], ['Page', 'Página'], ['page', 'página'],
  ['Zone', 'Zona'], ['zone', 'zona'], ['Phase', 'Fase'], ['phase', 'fase'],
  ['Barrages', 'Playoffs'], ['barrages', 'playoffs'], ['Demi-finales', 'Semifinales'],
  ['Quarts de finale', 'Cuartos de final'], ['8es de finale', 'Octavos de final'],
  ['3e place', '3.er puesto'], ['Fin du match', 'Final del partido'], ['Coup d\'envoi', 'Saque inicial'],
  ['Affluence', 'Asistencia'], ['Capacité', 'Capacidad'], ['capacité', 'capacidad'],
  ['Recettes billetterie', 'Recaudación de taquilla'], ['Boîte', 'Bandeja'], ['boîte', 'bandeja'],
  ['Inbox', 'Bandeja de entrada'], ['inbox', 'bandeja de entrada'],
  ['Tout marquer comme lu', 'Marcar todo como leído'], ['Aucun message', 'Sin mensajes'],
  ['Action requise', 'Requiere acción'], ['Réponse requise', 'Respuesta requerida'],
  ['Accepter', 'Aceptar'], ['Acceptation', 'Aceptación'], ['Refus', 'Rechazo'],
  ['Confirmation', 'Confirmación'], ['Proposer', 'Proponer'], ['proposer', 'proponer'],
  ['Demander', 'Solicitar'], ['demander', 'solicitar'], ['autre date', 'otra fecha'],
  ['Système STAGE', 'Sistema STAGE'], ['Garder le message', 'Conservar mensaje'],
  ['Supprimer quand même', 'Eliminar de todos modos'], ['sans répondre', 'sin responder'],
  ['Détails du match', 'Detalles del partido'], ['Match classé', 'Partido clasificatorio'],
  ['Phase de groupes', 'Fase de grupos'], ['Élimination', 'Eliminatoria'], ['élimination', 'eliminatoria'],
  ['Double élim.', 'Doble elim.'], ['Organiser un match', 'Organizar partido'],
  ['Adversaire', 'Rival'], ['adversaire', 'rival'], ['Lieu', 'Sede'], ['lieu', 'sede'],
  ['Date', 'Fecha'], ['date', 'fecha'], ['Heure', 'Hora'], ['heure', 'hora'],
  ['Fin du contrat', 'Fin de contrato'], ['Contrat bientôt expiré', 'Contrato por expirar'],
  ['Appuie pour voir les détails', 'Toca para ver detalles'],
  ['agents libres', 'agentes libres'], ['libres', 'libres'], ['expirants', 'por expirar'],
  ['Envoyé', 'Enviado'], ['envoyé', 'enviado'], ['Expire bientôt', 'Por expirar'],
  ['Sous contrat', 'Bajo contrato'], ['Statut', 'Estado'], ['statut', 'estado'],
  ['Club actuel', 'Club actual'], ['Matchs restants', 'Partidos restantes'],
  ['Agent libre - disponible maintenant', 'Agente libre — disponible ahora'],
  ['Parcours les joueurs', 'Explora jugadores'], ['offres de contrat', 'ofertas de contrato'],
  ['Offre déjà envoyée', 'Oferta ya enviada'], ['Voir le profil complet', 'Ver perfil completo'],
  ['historique complet', 'historial completo'], ['sources de revenus', 'fuentes de ingresos'],
  ['Temps forts', 'Destacados'], ['updates de la communauté', 'actualizaciones de la comunauté'],
  ['Créer un post', 'Crear publicación'], ['Partage quelque chose', 'Comparte algo'],
  ['Publication...', 'Publicando...'], ['Aucun post', 'Sin publicaciones'],
  ['Sois le premier', 'Sé el primero'], ['Ajouter un commentaire', 'Añadir un comentario'],
  ['Actualités', 'Noticias'], ['Général', 'General'], ['général', 'general'],
  ['En vedette', 'Destacado'], ['Recherche des joueurs', 'Buscar jugadores'],
  ['Tous les postes', 'Todas las posiciones'], ['Toutes les plateformes', 'Todas las plataformas'],
  ['Toutes les régions', 'Todas las regiones'], ['Vérifiés uniquement', 'Solo verificados'],
  ['Post joueur', 'Publicación de jugador'], ['Post club', 'Publicación de club'],
  ['Joueurs qui cherchent', 'Jugadores buscando club'], ['Clubs qui recrutent', 'Clubes reclutando'],
  ['Club qui recrute', 'Club reclutando'], ['Essais', 'Pruebas'], ['Demande d\'essai', 'Solicitud de prueba'],
  ['Intérêt envoyé', 'Interés enviado'], ['Offre de contrat envoyée', 'Oferta de contrato enviada'],
  ['Aucun post ouvert', 'No hay publicaciones abiertas'], ['Change les filtres', 'Cambia los filtros'],
  ['Créer un post de recrutement', 'Crear publicación de reclutamiento'],
  ['Joueur qui cherche', 'Jugador buscando club'], ['Décris ce que tu cherches', 'Describe lo que buscas'],
  ['Postes recherchés', 'Posiciones necesarias'], ['Postes préférés', 'Posiciones preferidas'],
  ['Micro requis', 'Micrófono obligatorio'], ['Micro optionnel', 'Micrófono opcional'],
  ['Disponibilité ouverte', 'Disponibilidad abierta'], ['Montrer de l\'intérêt', 'Mostrar interés'],
  ['Écris un court message', 'Escribe un mensaje breve'], ['Envoyer l\'intérêt', 'Enviar interés'],
  ['Rouvrir', 'Reabrir'], ['rouvrir', 'reabrir'], ['Terminer', 'Completar'], ['terminer', 'completar'],
  ['En savoir plus', 'Saber más'], ['Bienvenue', 'Bienvenido'], ['Retour aux tournois', 'Volver a torneos'],
  ['Tous les droits réservés', 'Todos los derechos reservados'],
  ['Division', 'División'], ['division', 'división'], ['Div ', 'Div '],
  ['Places', 'Plazas'], ['places', 'plazas'], ['Place', 'Plaza'], ['place', 'plaza'],
  ['Liste d\'attente', 'Lista de espera'], ['liste d\'attente', 'lista de espera'],
  ['Retiré', 'Eliminado'], ['retiré', 'eliminado'], ['Approuvé', 'Aprobado'],
  ['Comment ça marche', 'Cómo funciona'], ['Comment fonctionne', 'Cómo funciona'],
  ['pyramide des compétitions', 'pirámide de competiciones'],
  ['Un admin doit', 'Un admin debe'], ['créer les 3 compétitions', 'crear las 3 competiciones'],
  ['Saison pas encore commencée', 'Temporada no iniciada'],
  ['Voir le classement complet', 'Ver clasificación completa'],
  ['de récompense', 'de premio'], ['Ligues régionales', 'Ligas regionales'],
  ['Joue dans la ligue', 'Compite en la ligue'], ['meilleurs gagnent', 'mejores obtienen'],
  ['prouvent leur niveau', 'demuestran su nivel'], ['montent en', 'ascienden a'],
  ['obtiennent le droit', 'obtienen el derecho'], ['plus haut niveau', 'máximo nivel'],
  ['Compète, gagne et réclame', 'Compite, gana y reclama'], ['ton trophée', 'tu trofeo'],
  ['STAGE Plus requis', 'STAGE Plus requerido'], ['attends une place', 'espera una plaza'],
  ['Trophées en jeu', 'Trofeos en juego'], ['Par {name}', 'Por {name}'],
  ['Configuration', 'Configuración'], ['Look & feel', 'Apariencia'], ['Création...', 'Creando...'],
  ['Classements officiels', 'Clasificaciones oficiales'], ['basés sur', 'basadas en'],
  ['sont exclus', 'se excluyen'], ['Matchs officiels', 'Partidos oficiales'],
  ['Clubs classés', 'Clubes clasificados'], ['Joueurs classés', 'Jugadores clasificados'],
  ['Portée', 'Ámbito'], ['portée', 'ámbito'], ['Meilleurs par poste', 'Mejores por posición'],
  ['n\'a encore', 'aún no tiene'], ['N\'a encore', 'Aún no tiene'],
  ['données de classement', 'datos de clasificación'], ['joueurs inscrits', 'jugadores registrados'],
  ['Inscription saison', 'Inscripción de temporada'], ['Inscris ton club', 'Inscribe tu club'],
  ['Les places sont limitées', 'Las plazas son limitadas'], ['postule tôt', 'solicita pronto'],
  ['Mes candidatures', 'Mis solicitudes'], ['n\'est ouverte', 'está abierta'],
  ['Reviens quand', 'Vuelve cuando'], ['statut Inscription', 'estado Inscripción'],
  ['préférée', 'preferida'], ['Assigné à', 'Asignado a'], ['t\'assignera', 'te asignará'],
  ['après examen', 'tras revisar'], ['Créer un club d\'abord', 'Crear club primero'],
  ['Rejoindre la liste', 'Unirse a la lista'], ['Envoyer la candidature', 'Enviar solicitud'],
  ['Division 1 - Élite', 'División 1 — Máxima categoría'],
  ['Division 2 - Développement', 'División 2 — Desarrollo'],
  ['C\'est une préférence', 'Es una preferencia'], ['décidé par l\'admin', 'decidido por el admin'],
  ['Note (optionnel)', 'Nota (opcional)'], ['Contexte pour l\'admin', 'Contexto para el admin'],
  [' — ', ' — '], ['…', '…'], ['!', '!'], ['?', '?'],
];

// Build PT and IT from FR_ES by mapping Spanish to Portuguese/Italian
const ES_TO_PT = [
  ['Tu ', 'O teu '], ['tu ', 'o teu '], ['Tus ', 'Os teus '], ['tus ', 'os teus '],
  ['Te ', 'Te '], ['te ', 'te '], ['Tú ', 'Tu '], ['tú ', 'tu '],
  ['Ningún', 'Nenhum'], ['Ninguna', 'Nenhuma'], ['ningún', 'nenhum'], ['ninguna', 'nenhuma'],
  ['Encuentra', 'Encontra'], ['encuentra', 'encontra'], ['Buscar', 'Pesquisar'], ['buscar', 'pesquisar'],
  ['jugador', 'jogador'], ['jugadores', 'jogadores'], ['Jugador', 'Jogador'], ['Jugadores', 'Jogadores'],
  ['clubes', 'clubes'], ['partido', 'jogo'], ['partidos', 'jogos'], ['Partido', 'Jogo'], ['Partidos', 'Jogos'],
  ['torneo', 'torneio'], ['torneos', 'torneios'], ['Torneo', 'Torneio'], ['Torneos', 'Torneios'],
  ['liga', 'liga'], ['competición', 'competição'], ['competiciones', 'competições'],
  ['Competición', 'Competição'], ['Competiciones', 'Competições'],
  ['temporada', 'temporada'], ['contrato', 'contrato'], ['contratos', 'contratos'],
  ['fichaje', 'transferência'], ['fichajes', 'transferências'], ['Fichaje', 'Transferência'],
  ['¿Seguro que quieres', 'Tens a certeza de que queres'], ['¿Estás ', 'Estás '], ['¿', ''],
  ['No se pudo', 'Não foi possível'], ['Imposible ', 'Impossível '],
  ['Elige', 'Escolhe'], ['elige', 'escolhe'], ['Selecciona', 'Seleciona'], ['selecciona', 'seleciona'],
  ['Enviar', 'Enviar'], ['Enviado', 'Enviado'], ['Guardar', 'Guardar'], ['Guardado', 'Guardado'],
  ['Eliminar', 'Eliminar'], ['Eliminación', 'Eliminação'], ['Cancelar', 'Cancelar'],
  ['Volver', 'Voltar'], ['Siguiente', 'Seguinte'], ['Continuar', 'Continuar'],
  ['Omitir', 'Saltar'], ['Crear', 'Criar'], ['Creación', 'Criação'], ['Editar', 'Editar'],
  ['Ver', 'Ver'], ['Abrir', 'Abrir'], ['Cerrar', 'Fechar'], ['Aceptar', 'Aceitar'],
  ['Rechazar', 'Recusar'], ['Confirmar', 'Confirmar'], ['Cargando', 'A carregar'],
  ['Votar', 'Votar'], ['Inscripción', 'Inscrição'], ['Inscribe', 'Inscreve'], ['Inscrito', 'Inscrito'],
  ['Solicitar', 'Candidatar'], ['Solicitado', 'Candidatado'], ['Aprobado', 'Aprovado'],
  ['Rechazado', 'Rejeitado'], ['Pendiente', 'Pendente'], ['Programado', 'Agendado'],
  ['Confirmado', 'Confirmado'], ['Disputado', 'Disputado'], ['Walkover', 'W.O.'],
  ['Por definir', 'A definir'], ['Desconocido', 'Desconhecido'], ['Opcional', 'Opcional'],
  ['Obligatorio', 'Obrigatório'], ['Gratis', 'Grátis'], ['Completo', 'Cheio'], ['Abierto', 'Aberto'],
  ['Finalizado', 'Concluído'], ['Local', 'Casa'], ['Visitante', 'Fora'],
  ['Equipo', 'Equipa'], ['Equipos', 'Equipas'], ['Resultado', 'Resultado'],
  ['Clasificación', 'Classificação'], ['Clasificaciones', 'Classificações'],
  ['Perfil', 'Perfil'], ['Ajustes', 'Definições'], ['Tienda', 'Loja'],
  ['Créditos', 'Créditos'], ['Plataforma', 'Plataforma'], ['Región', 'Região'], ['País', 'País'],
  ['Posición', 'Posição'], ['Goles', 'Golos'], ['Asistencias', 'Assistências'],
  ['Valoración', 'Avaliação'], ['Notas', 'Notas'], ['Trofeo', 'Troféu'], ['Trofeos', 'Troféus'],
  ['Ganador', 'Vencedor'], ['Campeón', 'Campeão'], ['Final', 'Final'], ['Ronda', 'Ronda'],
  ['Jornada', 'Jornada'], ['Empate', 'Empate'], ['Victoria', 'Vitória'], ['Derrota', 'Derrota'],
  ['Invitar', 'Convidar'], ['Desafiar', 'Desafiar'], ['Mensaje', 'Mensagem'], ['Mensajes', 'Mensagens'],
  ['Anuncio', 'Anúncio'], ['Notificación', 'Notificação'], ['Notificaciones', 'Notificações'],
  ['Comunidad', 'Comunidade'], ['Reclutamiento', 'Recrutamento'],
  ['agente libre', 'agente livre'], ['agentes libres', 'agentes livres'],
  ['Mercado', 'Mercado'], ['Salario', 'Salário'], ['Prima', 'Bónus'],
  ['Presupuesto', 'Orçamento'], ['Finanzas', 'Finanças'], ['Estadio', 'Estádio'],
  ['Camisetas', 'Camisolas'], ['Historial', 'Histórico'], ['Calendario', 'Calendário'],
  ['Vestuario', 'Balneário'], ['Subir', 'Carregar'], ['Descargar', 'Descarregar'],
  ['Unirse', 'Juntar-se'], ['Salir', 'Sair'], ['Seguir', 'Seguir'], ['Dejar de seguir', 'Deixar de seguir'],
  ['Publicar', 'Publicar'], ['Compartir', 'Partilhar'], ['Actualizar', 'Atualizar'],
  ['Reintentar', 'Tentar novamente'], ['Empezar', 'Começar'], ['Iniciar sesión', 'Iniciar sessão'],
  ['Cerrar sesión', 'Terminar sessão'], ['Presidente', 'Presidente'], ['Capitán', 'Capitão'],
  ['Miembro', 'Membro'], ['Plantilla', 'Plantel'], ['Descripción', 'Descrição'],
  ['Nombre', 'Nome'], ['Título', 'Título'], ['Foto', 'Foto'], ['Imagen', 'Imagem'],
  ['Vídeo', 'Vídeo'], ['Artículo', 'Artigo'], ['Rueda de prensa', 'Conferência de imprensa'],
  ['Sala de prensa', 'Sala de imprensa'], ['Recompensa', 'Recompensa'], ['Premio', 'Prémio'],
  ['Entrada', 'Entrada'], ['Coste', 'Custo'], ['Bote de premios', 'Prémio total'],
  ['Reglas', 'Regras'], ['Oficial', 'Oficial'], ['Verificado', 'Verificado'],
  ['Regional', 'Regional'], ['Todos', 'Todos'], ['Todas', 'Todas'], ['Todo', 'Tudo'],
  ['encontrado', 'encontrado'], ['no encontrado', 'não encontrado'], ['aún no', 'ainda não'],
  ['por ahora', 'por agora'], ['ahora', 'agora'], ['Hoy', 'Hoje'], ['días', 'dias'],
  ['día', 'dia'], ['semana', 'semana'], ['mes', 'mês'], ['año', 'ano'],
  ['Anual', 'Anual'], ['Mensual', 'Mensal'], ['semanal', 'semanal'], ['por semana', 'por semana'],
  ['por mes', 'por mês'], ['Acción irreversible', 'Ação irreversível'],
  ['Acción fallida', 'Ação falhou'], ['Inténtalo de nuevo', 'Tenta novamente'],
  ['Suscribirse', 'Subscrever'], ['Suscripciones', 'Subscrições'], ['Comprar', 'Comprar'],
  ['Oferta', 'Oferta'], ['Plan actual', 'Plano atual'], ['Cuenta gratuita', 'Conta gratuita'],
  ['Propietario', 'Proprietário'], ['Capitanía', 'Capitania'],
  ['Tarifa de fichaje', 'Taxa de transferência'], ['Ventana de fichajes', 'Janela de transferências'],
  ['Valor de mercado', 'Valor de mercado'], ['Forma reciente', 'Forma recente'],
  ['Balance', 'Registo'], ['Títulos', 'Títulos'], ['Estadísticas', 'Estatísticas'],
  ['Carrera', 'Carreira'], ['Prueba', 'Teste'], ['Solicitud', 'Candidatura'],
  ['Disputa', 'Disputa'], ['Reclamación', 'Reclamação'], ['Resolver', 'Resolver'],
  ['Aprobar', 'Aprovar'], ['Revisar', 'Rever'], ['Paso', 'Passo'], ['de', 'de'],
  ['Página', 'Página'], ['Zona', 'Zona'], ['Fase', 'Fase'], ['Playoffs', 'Playoffs'],
  ['Semifinales', 'Meias-finais'], ['Cuartos de final', 'Quartos de final'],
  ['Octavos de final', 'Oitavos de final'], ['3.er puesto', '3.º lugar'],
  ['Final del partido', 'Fim de jogo'], ['Saque inicial', 'Pontapé de saída'],
  ['Asistencia', 'Público'], ['Capacidad', 'Capacidade'],
  ['Recaudación de taquilla', 'Receita de bilhetes'], ['Bandeja', 'Caixa'],
  ['Bandeja de entrada', 'Caixa de entrada'], ['Marcar todo como leído', 'Marcar tudo como lido'],
  ['Sin mensajes', 'Sem mensagens'], ['Requiere acción', 'Requer ação'],
  ['Respuesta requerida', 'Resposta necessária'], ['Detalles del partido', 'Detalhes do jogo'],
  ['Partido clasificatorio', 'Jogo ranqueado'], ['Fase de grupos', 'Fase de grupos'],
  ['Eliminatoria', 'Eliminatória'], ['Doble elim.', 'Dupla elim.'],
  ['Organizar partido', 'Marcar jogo'], ['Rival', 'Adversário'], ['Sede', 'Local'],
  ['Fecha', 'Data'], ['Hora', 'Hora'], ['Fin de contrato', 'Fim de contrato'],
  ['Contrato por expirar', 'Contrato a expirar em breve'],
  ['Toca para ver detalles', 'Toca para ver detalhes'],
  ['por expirar', 'a expirar'], ['Bajo contrato', 'Sob contrato'], ['Estado', 'Estado'],
  ['Club actual', 'Clube atual'], ['Partidos restantes', 'Jogos restantes'],
  ['agente libre — disponible ahora', 'agente livre — disponível agora'],
  ['Explora jugadores', 'Explora jogadores'], ['ofertas de contrato', 'ofertas de contrato'],
  ['Oferta ya enviada', 'Oferta já enviada'], ['Ver perfil completo', 'Ver perfil completo'],
  ['historial completo', 'histórico completo'], ['fuentes de ingresos', 'fontes de rendimento'],
  ['Destacados', 'Destaques'], ['actualizaciones de la comunidad', 'destaques da comunidade'],
  ['Crear publicación', 'Criar publicação'], ['Comparte algo', 'Partilha algo'],
  ['Publicando...', 'A publicar...'], ['Sin publicaciones', 'Sem publicações'],
  ['Sé el primero', 'Sê o primeiro'], ['Añadir un comentario', 'Adiciona um comentário'],
  ['Noticias', 'Notícias'], ['General', 'Geral'], ['Destacado', 'Em destaque'],
  ['Buscar jugadores', 'Pesquisar jogadores'], ['Todas las posiciones', 'Todas as posições'],
  ['Todas las plataformas', 'Todas as plataformas'], ['Todas las regiones', 'Todas as regiões'],
  ['Solo verificados', 'Apenas verificados'], ['Publicación de jugador', 'Publicação de jogador'],
  ['Publicación de club', 'Publicação de clube'], ['Jugadores buscando club', 'Jogadores à procura de clube'],
  ['Clubes reclutando', 'Clubes a recrutar'], ['Club reclutando', 'Clube a recrutar'],
  ['Pruebas', 'Testes'], ['Solicitud de prueba', 'Pedido de teste'],
  ['Interés enviado', 'Interesse enviado'], ['Oferta de contrato enviada', 'Oferta de contrato enviada'],
  ['No hay publicaciones abiertas', 'Nenhuma publicação aberta'],
  ['Cambia los filtros', 'Altera os filtros'],
  ['Crear publicación de reclutamiento', 'Criar publicação de recrutamento'],
  ['Jugador buscando club', 'Jogador à procura de clube'],
  ['Describe lo que buscas', 'Descreve o que procuras'],
  ['Posiciones necesarias', 'Posições necessárias'], ['Posiciones preferidas', 'Posições preferidas'],
  ['Micrófono obligatorio', 'Microfone obrigatório'], ['Micrófono opcional', 'Microfone opcional'],
  ['Disponibilidad abierta', 'Disponibilidade aberta'], ['Mostrar interés', 'Mostrar interesse'],
  ['Escribe un mensaje breve', 'Escreve uma mensagem breve'], ['Enviar interés', 'Enviar interesse'],
  ['Reabrir', 'Reabrir'], ['Completar', 'Concluir'], ['Saber más', 'Saber mais'],
  ['Bienvenido', 'Bem-vindo'], ['Volver a torneos', 'Voltar aos torneios'],
  ['Todos los derechos reservados', 'Todos os direitos reservados'],
  ['División', 'Divisão'], ['Plazas', 'Vagas'], ['plazas', 'vagas'],
  ['Lista de espera', 'Lista de espera'], ['Eliminado', 'Removido'],
  ['Cómo funciona', 'Como funciona'], ['pirámide de competiciones', 'pirâmide de competições'],
  ['Un admin debe', 'Um admin precisa de'], ['crear las 3 competiciones', 'criar as 3 competições'],
  ['Temporada no iniciada', 'Temporada ainda não iniciada'],
  ['Ver clasificación completa', 'Ver classificação completa'],
  ['de premio', 'de prémio'], ['Ligas regionales', 'Ligas regionais'],
  ['Compite en la ligue', 'Compete na liga'], ['mejores obtienen', 'melhores ganham'],
  ['demuestran su nivel', 'provam o seu valor'], ['ascienden a', 'sobem para'],
  ['obtienen el derecho', 'ganham o direito'], ['máximo nivel', 'mais alto nível'],
  ['Compite, gana y reclama', 'Compete, ganha e reclama'], ['tu trofeo', 'o teu troféu'],
  ['STAGE Plus requerido', 'STAGE Plus necessário'], ['espera una plaza', 'aguarda vaga'],
  ['Trofeos en juego', 'Troféus em jogo'], ['Por {name}', 'Por {name}'],
  ['Configuración', 'Configuração'], ['Apariencia', 'Aparência'], ['Creando...', 'A criar...'],
  ['Clasificaciones oficiales', 'Classificações oficiais'], ['basadas en', 'baseadas em'],
  ['se excluyen', 'são excluídos'], ['Partidos oficiales', 'Jogos oficiais'],
  ['Clubes clasificados', 'Clubes classificados'], ['Jugadores clasificados', 'Jogadores classificados'],
  ['Ámbito', 'Âmbito'], ['Mejores por posición', 'Melhores por posição'],
  ['aún no tiene', 'ainda não tem'], ['datos de clasificación', 'dados de classificação'],
  ['jugadores registrados', 'jogadores registados'],
  ['Inscripción de temporada', 'Inscrição de temporada'], ['Inscribe tu club', 'Regista o teu clube'],
  ['Las plazas son limitadas', 'As vagas são limitadas'], ['solicita pronto', 'candidata-te cedo'],
  ['Mis solicitudes', 'As minhas candidaturas'], ['está abierta', 'está aberta'],
  ['Vuelve cuando', 'Volta quando'], ['estado Inscripción', 'estado Inscrição'],
  ['preferida', 'preferida'], ['Asignado a', 'Atribuído a'], ['te asignará', 'atribuir-te-á'],
  ['tras revisar', 'após rever'], ['Crear club primero', 'Criar clube primeiro'],
  ['Unirse a la lista', 'Entrar na lista de espera'], ['Enviar solicitud', 'Enviar candidatura'],
  ['División 1 — Máxima categoría', 'Divisão 1 — Elite'],
  ['División 2 — Desarrollo', 'Divisão 2 — Desenvolvimento'],
  ['Es una preferencia', 'É uma preferência'], ['decidido por el admin', 'decidido pelo admin'],
  ['Nota (opcional)', 'Nota (opcional)'], ['Contexto para el admin', 'Contexto para o admin'],
];

const ES_TO_IT = [
  ['Tu ', 'Il tuo '], ['tu ', 'il tuo '], ['Tus ', 'I tuoi '], ['tus ', 'i tuoi '],
  ['Tú ', 'Tu '], ['tú ', 'tu '], ['Ningún', 'Nessun'], ['Ninguna', 'Nessuna'],
  ['Encuentra', 'Trova'], ['Buscar', 'Cerca'], ['jugador', 'giocatore'], ['jugadores', 'giocatori'],
  ['Jugador', 'Giocatore'], ['Jugadores', 'Giocatori'], ['partido', 'partita'], ['partidos', 'partite'],
  ['Partido', 'Partita'], ['Partidos', 'Partite'], ['torneo', 'torneo'], ['torneos', 'tornei'],
  ['Torneo', 'Torneo'], ['Torneos', 'Tornei'], ['competición', 'competizione'],
  ['competiciones', 'competizioni'], ['Competición', 'Competizione'], ['Competiciones', 'Competizioni'],
  ['temporada', 'stagione'], ['fichaje', 'trasferimento'], ['fichajes', 'trasferimenti'],
  ['¿Seguro que quieres', 'Sei sicuro di voler'], ['¿', ''], ['No se pudo', 'Impossibile'],
  ['Elige', 'Scegli'], ['Selecciona', 'Seleziona'], ['Enviar', 'Invia'], ['Enviado', 'Inviato'],
  ['Guardar', 'Salva'], ['Eliminar', 'Elimina'], ['Cancelar', 'Annulla'], ['Volver', 'Indietro'],
  ['Siguiente', 'Avanti'], ['Continuar', 'Continua'], ['Omitir', 'Salta'], ['Crear', 'Crea'],
  ['Editar', 'Modifica'], ['Ver', 'Vedi'], ['Abrir', 'Apri'], ['Cerrar', 'Chiudi'],
  ['Aceptar', 'Accetta'], ['Rechazar', 'Rifiuta'], ['Confirmar', 'Conferma'], ['Cargando', 'Caricamento'],
  ['Votar', 'Vota'], ['Inscripción', 'Iscrizione'], ['Inscribe', 'Iscrivi'], ['Inscrito', 'Iscritto'],
  ['Solicitar', 'Candidati'], ['Aprobado', 'Approvato'], ['Rechazado', 'Rifiutato'],
  ['Pendiente', 'In attesa'], ['Programado', 'Programmato'], ['Confirmado', 'Confermato'],
  ['Disputado', 'Contestata'], ['Walkover', 'Forfait'], ['Por definir', 'Da definire'],
  ['Desconocido', 'Sconosciuto'], ['Opcional', 'Opzionale'], ['Obligatorio', 'Obbligatorio'],
  ['Gratis', 'Gratis'], ['Completo', 'Completo'], ['Abierto', 'Aperto'], ['Finalizado', 'Terminato'],
  ['Local', 'Casa'], ['Visitante', 'Trasferta'], ['Equipo', 'Squadra'], ['Equipos', 'Squadre'],
  ['Resultado', 'Risultato'], ['Clasificación', 'Classifica'], ['Clasificaciones', 'Classifiche'],
  ['Perfil', 'Profilo'], ['Ajustes', 'Impostazioni'], ['Tienda', 'Negozio'],
  ['Región', 'Regione'], ['País', 'Paese'], ['Posición', 'Ruolo'], ['Goles', 'Gol'],
  ['Asistencias', 'Assist'], ['Valoración', 'Valutazione'], ['Trofeo', 'Trofeo'], ['Trofeos', 'Trofei'],
  ['Ganador', 'Vincitore'], ['Campeón', 'Campione'], ['Ronda', 'Turno'], ['Jornada', 'Giornata'],
  ['Empate', 'Pareggio'], ['Victoria', 'Vittoria'], ['Derrota', 'Sconfitta'],
  ['Invitar', 'Invita'], ['Desafiar', 'Sfida'], ['Mensaje', 'Messaggio'], ['Mensajes', 'Messaggi'],
  ['Anuncio', 'Annuncio'], ['Notificación', 'Notifica'], ['Notificaciones', 'Notifiche'],
  ['Comunidad', 'Community'], ['Reclutamiento', 'Reclutamento'],
  ['agente libre', 'svincolato'], ['agentes libres', 'svincolati'],
  ['Salario', 'Stipendio'], ['Prima', 'Bonus'], ['Presupuesto', 'Budget'],
  ['Finanzas', 'Finanze'], ['Estadio', 'Stadio'], ['Camisetas', 'Maglie'],
  ['Historial', 'Storico'], ['Vestuario', 'Spogliatoio'], ['Subir', 'Carica'],
  ['Descargar', 'Scarica'], ['Unirse', 'Unisciti'], ['Salir', 'Esci'],
  ['Dejar de seguir', 'Smetti di seguire'], ['Publicar', 'Pubblica'], ['Compartir', 'Condividi'],
  ['Actualizar', 'Aggiorna'], ['Reintentar', 'Riprova'], ['Empezar', 'Inizia'],
  ['Iniciar sesión', 'Accedi'], ['Cerrar sesión', 'Esci'], ['Capitán', 'Capitano'],
  ['Plantilla', 'Rosa'], ['Descripción', 'Descrizione'], ['Nombre', 'Nome'], ['Título', 'Titolo'],
  ['Imagen', 'Immagine'], ['Vídeo', 'Video'], ['Artículo', 'Articolo'],
  ['Rueda de prensa', 'Conferenza stampa'], ['Sala de prensa', 'Sala stampa'],
  ['Recompensa', 'Ricompensa'], ['Premio', 'Premio'], ['Coste', 'Costo'],
  ['Bote de premios', 'Montepremi'], ['Reglas', 'Regole'], ['Oficial', 'Ufficiale'],
  ['Verificado', 'Verificato'], ['Global', 'Globale'], ['Regional', 'Regionale'],
  ['Todos', 'Tutti'], ['Todas', 'Tutte'], ['Todo', 'Tutto'],
  ['no encontrado', 'non trovato'], ['aún no', 'ancora non'], ['por ahora', 'per ora'],
  ['ahora', 'ora'], ['Hoy', 'Oggi'], ['días', 'giorni'], ['día', 'giorno'],
  ['mes', 'mese'], ['año', 'anno'], ['Anual', 'Annuale'], ['Mensual', 'Mensile'],
  ['Acción irreversible', 'Azione irreversibile'], ['Inténtalo de nuevo', 'Riprova'],
  ['Suscribirse', 'Abbonati'], ['Suscripciones', 'Abbonamenti'], ['Propietario', 'Proprietario'],
  ['Ventana de fichajes', 'Mercato trasferimenti'], ['Valor de mercado', 'Valore di mercato'],
  ['Forma reciente', 'Forma recente'], ['Balance', 'Record'], ['Estadísticas', 'Statistiche'],
  ['Carrera', 'Carriera'], ['Prueba', 'Prova'], ['Solicitud', 'Candidatura'],
  ['Disputa', 'Controversia'], ['Reclamación', 'Reclamo'], ['Resolver', 'Risolvi'],
  ['Aprobar', 'Approva'], ['Revisar', 'Rivedi'], ['Paso', 'Passo'], ['Página', 'Pagina'],
  ['Semifinales', 'Semifinali'], ['Cuartos de final', 'Quarti di finale'],
  ['Octavos de final', 'Ottavi di finale'], ['3.er puesto', 'Terzo posto'],
  ['Final del partido', 'Fine partita'], ['Saque inicial', 'Calcio d\'inizio'],
  ['Asistencia', 'Presenze'], ['Capacidad', 'Capacità'],
  ['Bandeja de entrada', 'Posta in arrivo'], ['Marcar todo como leído', 'Segna tutto come letto'],
  ['Sin mensajes', 'Nessun messaggio'], ['Requiere acción', 'Richiede azione'],
  ['Detalles del partido', 'Dettagli partita'], ['Partido clasificatorio', 'Partita classificata'],
  ['Fase de grupos', 'Fase a gironi'], ['Eliminatoria', 'Eliminazione'],
  ['Organizar partido', 'Organizza partita'], ['Rival', 'Avversario'], ['Sede', 'Sede'],
  ['Fin de contrato', 'Fine contratto'], ['Contrato por expirar', 'Contratto in scadenza'],
  ['Toca para ver detalles', 'Tocca per vedere i dettagli'],
  ['Bajo contrato', 'Sotto contratto'], ['Estado', 'Stato'], ['Club actual', 'Club attuale'],
  ['Partidos restantes', 'Partite rimaste'], ['Noticias', 'News'], ['General', 'Generale'],
  ['Reabrir', 'Riapri'], ['Completar', 'Completa'], ['Saber más', 'Scopri di più'],
  ['Bienvenido', 'Benvenuto'], ['Volver a torneos', 'Torna ai tornei'],
  ['Todos los derechos reservados', 'Tutti i diritti riservati'],
  ['División', 'Divisione'], ['Plazas', 'Posti'], ['Lista de espera', 'Lista d\'attesa'],
  ['Eliminado', 'Rimosso'], ['Cómo funciona', 'Come funziona'],
  ['pirámide de competiciones', 'piramide delle competizioni'],
  ['Temporada no iniciada', 'Stagione non iniziata'],
  ['Ver clasificación completa', 'Vedi classifica completa'],
  ['Ligas regionales', 'Leghe regionali'], ['Compite, gana y reclama', 'Competi, vinci e reclama'],
  ['tu trofeo', 'il tuo trofeo'], ['espera una plaza', 'attendi un posto'],
  ['Trofeos en juego', 'Trofei in palio'], ['Configuración', 'Configurazione'],
  ['Apariencia', 'Aspetto'], ['Creando...', 'Creazione...'],
  ['Clasificaciones oficiales', 'Classifiche ufficiali'], ['Partidos oficiales', 'Partite ufficiali'],
  ['Clubes clasificados', 'Club classificati'], ['Jugadores clasificados', 'Giocatori classificati'],
  ['Ámbito', 'Ambito'], ['Mejores por posición', 'Migliori per ruolo'],
  ['Inscripción de temporada', 'Iscrizione stagione'], ['Inscribe tu club', 'Iscrivi il tuo club'],
  ['Mis solicitudes', 'Le mie candidature'], ['Crear club primero', 'Crea club prima'],
  ['Enviar solicitud', 'Invia candidatura'], ['Nota (opcional)', 'Nota (opzionale)'],
];

for (const rules of [FR_ES, ES_TO_PT, ES_TO_IT]) {
  rules.sort((a, b) => b[0].length - a[0].length);
}

function convert(text, rules) {
  const { out, store } = protectTokens(text);
  const converted = applyRules(out, rules);
  return restoreTokens(converted, store);
}

function frToEs(text) { return convert(text, FR_ES); }
function esToPt(text) { return convert(text, ES_TO_PT); }
function esToIt(text) { return convert(text, ES_TO_IT); }

// EN fallback rules for keys where FR === EN
const EN_ES_FALLBACK = [
  ['No free agents found.', 'No se encontraron agentes libres.'],
  ['{count} player{plural} found', '{count} jugador{plural} encontrado{plural}'],
  ['{count} free agents', '{count} agentes libres'],
  ['{count} free', '{count} libres'],
  ['{count} expiring', '{count} por expirar'],
  ['Sent', 'Enviado'], ['Current Club', 'Club actual'], ['Status', 'Estado'],
  ['Community highlights & updates', 'Destacados y actualizaciones de la comunidad'],
  ['Post', 'Publicar'], ['Posting...', 'Publicando...'], ['Share', 'Compartir'],
  ['News will appear as transfers, contracts, matches and tournaments happen.',
   'Las noticias aparecerán con fichajes, contratos, partidos y torneos.'],
  ['Club News', 'Noticias del club'], ['General', 'General'], ['Featured', 'Destacado'],
  ['Club Post', 'Publicación de club'], ['Looking for Club', 'Busca club'],
  ['Club Recruiting', 'Club reclutando'], ['Interest sent.', 'Interés enviado.'],
  ['No open posts found', 'No hay publicaciones abiertas'],
  ['Preferred positions', 'Posiciones preferidas'],
  ['Availability, e.g. Tonight 21:00 CET', 'Disponibilidad, ej. Esta noche 21:00 CET'],
  ['Mic required', 'Micrófono obligatorio'], ['Write a short message...', 'Escribe un mensaje breve...'],
  ['Availability open', 'Disponibilidad abierta'], ['Reopen', 'Reabrir'], ['Complete', 'Completar'],
  ['Pick', 'Elegir'], ['Vote', 'Votar'], ['{count} matches', '{count} partidos'],
  ['Follow Back', 'Follow Back'], ['Global', 'Global'], ['EA FC', 'EA FC'],
  ['Div {division}', 'Div {division}'], ['{wins}W {losses}L', '{wins}V {losses}D'],
  ['W{wins} D{draws} L{losses}', 'V{wins} E{draws} D{losses}'],
];

const EN_PT_FALLBACK = EN_ES_FALLBACK.map(([a, b]) => {
  const m = {
    'No se encontraron agentes libres.': 'Nenhum agente livre encontrado.',
    '{count} jugador{plural} encontrado{plural}': '{count} jogador{plural} encontrado{plural}',
    '{count} agentes libres': '{count} agentes livres', '{count} libres': '{count} livres',
    '{count} por expirar': '{count} a expirar', 'Enviado': 'Enviado', 'Club actual': 'Clube atual',
    'Estado': 'Estado', 'Destacados y actualizaciones de la comunidad': 'Destaques e atualizações da comunidade',
    'Publicar': 'Publicar', 'Publicando...': 'A publicar...', 'Compartir': 'Partilhar',
    'Las noticias aparecerán con fichajes, contratos, partidos y torneos.':
      'As notícias aparecerão com transferências, contratos, jogos e torneios.',
    'Noticias del club': 'Notícias do clube', 'Destacado': 'Em destaque',
    'Publicación de club': 'Publicação de clube', 'Busca club': 'Procura clube',
    'Club reclutando': 'Clube a recrutar', 'Interés enviado.': 'Interesse enviado.',
    'No hay publicaciones abiertas': 'Nenhuma publicação aberta',
    'Posiciones preferidas': 'Posições preferidas',
    'Disponibilidad, ej. Esta noche 21:00 CET': 'Disponibilidade, ex. Esta noite 21:00 CET',
    'Micrófono obligatorio': 'Microfone obrigatório', 'Escribe un mensaje breve...': 'Escreve uma mensagem breve...',
    'Disponibilidad abierta': 'Disponibilidade aberta', 'Reabrir': 'Reabrir', 'Completar': 'Concluir',
    'Elegir': 'Escolher', 'Votar': 'Votar', '{count} partidos': '{count} jogos',
    '{wins}V {losses}D': '{wins}V {losses}D',
    'V{wins} E{draws} D{losses}': 'V{wins} E{draws} D{losses}',
  };
  return [a, m[b] || b];
});

const EN_IT_FALLBACK = EN_ES_FALLBACK.map(([a, b]) => {
  const m = {
    'No se encontraron agentes libres.': 'Nessuno svincolato trovato.',
    '{count} jugador{plural} encontrado{plural}': '{count} giocator{plural} trovat{plural}',
    '{count} agentes libres': '{count} svincolati', '{count} libres': '{count} liberi',
    '{count} por expirar': '{count} in scadenza', 'Enviado': 'Inviato', 'Club actual': 'Club attuale',
    'Estado': 'Stato', 'Destacados y actualizaciones de la comunidad': 'Highlight e aggiornamenti della community',
    'Publicar': 'Pubblica', 'Publicando...': 'Pubblicazione...', 'Compartir': 'Condividi',
    'Las noticias aparecerán con fichajes, contratos, partidos y torneos.':
      'Le news appariranno con trasferimenti, contratti, partite e tornei.',
    'Noticias del club': 'News del club', 'Destacado': 'In evidenza',
    'Publicación de club': 'Post club', 'Busca club': 'Cerca club',
    'Club reclutando': 'Club reclutante', 'Interés enviado.': 'Interesse inviato.',
    'No hay publicaciones abiertas': 'Nessun post aperto',
    'Posiciones preferidas': 'Ruoli preferiti',
    'Disponibilidad, ej. Esta noche 21:00 CET': 'Disponibilità, es. Stasera 21:00 CET',
    'Micrófono obligatorio': 'Microfono richiesto', 'Escribe un mensaje breve...': 'Scrivi un messaggio breve...',
    'Disponibilidad abierta': 'Disponibilità aperta', 'Reabrir': 'Riapri', 'Completar': 'Completa',
    'Elegir': 'Scegli', 'Votar': 'Vota', '{count} partidos': '{count} partite',
    '{wins}V {losses}D': '{wins}V {losses}S',
    'V{wins} E{draws} D{losses}': 'V{wins} P{draws} S{losses}',
  };
  return [a, m[b] || b];
});

for (const rules of [EN_ES_FALLBACK, EN_PT_FALLBACK, EN_IT_FALLBACK]) {
  rules.sort((a, b) => b[0].length - a[0].length);
}

function translateKey(key, lang) {
  const enVal = en[key];
  const frVal = fr[key];
  let base;
  if (frVal !== enVal) {
    base = frToEs(frVal);
  } else {
    const fb = lang === 'es' ? EN_ES_FALLBACK : lang === 'pt' ? EN_PT_FALLBACK : EN_IT_FALLBACK;
    base = convert(enVal, fb);
    // If fallback didn't change much, apply minimal EN→ES rules on EN
    if (base === enVal && lang === 'es') base = convert(enVal, FR_ES);
  }
  if (lang === 'pt') return esToPt(base === enVal && frVal === enVal ? convert(enVal, EN_PT_FALLBACK) : base);
  if (lang === 'it') return esToIt(base === enVal && frVal === enVal ? convert(enVal, EN_IT_FALLBACK) : base);
  return base;
}

const MANUAL = {
  es: {
    internationalTitle: 'Internacional', submitting: 'Enviando...', achievement: 'Logro',
    dashboardPosition: 'Posición', dashboardFutMode: 'Modo', homeQuestions: 'Preguntas',
    homeContact: 'Contacto', trnFormat: 'Formato', otLifestyleTitle: 'Estilo de vida',
    matGarage: 'Garaje', matCollection: 'Colección', scalLive: 'En directo',
    newsTitle: 'Noticias', walletTitle: 'Monedero STC', general: 'General',
    profTab_stats: 'Estadísticas', ppTab_stats: 'Estadísticas', psPos: 'Pos', cdPos: 'Pos',
    coopTabStaff: 'Staff', cccMin: 'Mín', cccMax: 'Máx',
  },
  pt: {
    internationalTitle: 'Internacional', submitting: 'A enviar...', achievement: 'Conquista',
    dashboardPosition: 'Posição', dashboardFutMode: 'Modo', homeQuestions: 'Perguntas',
    homeContact: 'Contacto', trnFormat: 'Formato', otLifestyleTitle: 'Estilo de vida',
    matGarage: 'Garagem', matCollection: 'Coleção', scalLive: 'Ao vivo',
    newsTitle: 'Notícias', walletTitle: 'Carteira STC', general: 'Geral',
    profTab_stats: 'Estatísticas', ppTab_stats: 'Estatísticas', psPos: 'Pos', cdPos: 'Pos',
    coopTabStaff: 'Staff', cccMin: 'Mín', cccMax: 'Máx',
  },
  it: {
    internationalTitle: 'Internazionale', submitting: 'Invio...', achievement: 'Traguardo',
    dashboardPosition: 'Posizione', dashboardFutMode: 'Modalità', homeQuestions: 'Domande',
    homeContact: 'Contatti', trnFormat: 'Formato', otLifestyleTitle: 'Stile di vita',
    matGarage: 'Garage', matCollection: 'Collezione', scalLive: 'Live',
    newsTitle: 'News', walletTitle: 'Portafoglio STC', general: 'Generale',
    profTab_stats: 'Statistiche', ppTab_stats: 'Statistiche', psPos: 'Pos', cdPos: 'Pos',
    coopTabStaff: 'Staff', cccMin: 'Min', cccMax: 'Max',
  },
};

function build(lang) {
  const out = {};
  for (const key of Object.keys(en)) out[key] = translateKey(key, lang);
  Object.assign(out, MANUAL[lang] || {});
  return out;
}

function report(lang, data) {
  const keys = Object.keys(en);
  const missing = keys.filter((k) => !(k in data));
  const identical = keys.filter((k) => data[k] === en[k]);
  const pct = ((keys.length - identical.length) / keys.length * 100).toFixed(1);
  console.log(`${lang}: keys=${keys.length} missing=${missing.length} identicalToEn=${identical.length} (${(identical.length/keys.length*100).toFixed(1)}%) translated=${pct}%`);
  if (identical.length > 0 && identical.length <= 120) {
    console.log('  remaining:', identical.slice(0, 20).join(', '));
  }
  return { identical, pct: parseFloat(pct) };
}

for (const lang of ['es', 'pt', 'it']) {
  const data = build(lang);
  fs.writeFileSync(path.join(PACKS, `${lang}.commonPages.json`), JSON.stringify(data, null, 2) + '\n');
  report(lang, data);
}

console.log('Done.');
