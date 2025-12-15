# Guide de Logging pour le Débogage des Rooms

Ce document explique comment utiliser les nouveaux logs ajoutés au serveur pour déboguer les problèmes de rooms qui "plantent" et génèrent des 404.

## 📋 Types de Logs Ajoutés

### 1. Lifecycle des Rooms

#### `[ROOM_CREATED]`
```
[ROOM_CREATED] Room ABC123 created with TTL 7200s (2h)
```
- **Quand**: Une nouvelle room est créée
- **Info**: Code de la room + TTL Redis
- **Utilité**: Point de départ pour tracer la vie d'une room

#### `[ROOM_NOT_FOUND]`
```
[ROOM_NOT_FOUND] Room ABC123 not found in Redis - may have expired or been deleted
```
- **Quand**: Une tentative d'accès à une room qui n'existe plus
- **Info**: Code de la room
- **Causes possibles**:
  - TTL Redis expiré (après 2h)
  - Room supprimée par le cleanup (vide depuis >5min)
  - Room jamais créée

#### `[ROOM_TTL_WARNING]`
```json
[ROOM_TTL_WARNING] Room ABC123: TTL is low (1800s / 30min)
{
  "roomCode": "ABC123",
  "ttl": 1800,
  "roomAge": 5400,
  "memberCount": 3
}
```
- **Quand**: Le TTL d'une room passe sous 1 heure
- **Info**: Durée de vie restante, âge de la room, nombre de membres
- **Utilité**: Détecter les rooms qui vont bientôt expirer

### 2. Gestion des Membres

#### `[MEMBER_JOINED]`
```json
[MEMBER_JOINED] Room ABC123: Member "Alice" joined (uuid-session-id)
{
  "roomCode": "ABC123",
  "memberId": "uuid-session-id",
  "memberName": "Alice",
  "totalMembers": 3
}
```
- **Quand**: Un membre rejoint une room
- **Info**: Nom du membre, session ID, total de membres

#### `[MEMBER_REMOVED_MANUALLY]`
```json
[MEMBER_REMOVED_MANUALLY] Room ABC123: Member "Bob" removed by "Alice"
{
  "roomCode": "ABC123",
  "removedMemberId": "uuid-bob",
  "removedMemberName": "Bob",
  "removedBy": "uuid-alice",
  "removedByName": "Alice",
  "remainingMembers": 2
}
```
- **Quand**: Un membre est supprimé manuellement (via l'API)
- **Info**: Qui a supprimé qui, membres restants

### 3. Cleanup Automatique

#### `[CLEANUP_START]`
```
[CLEANUP_START] Starting cleanup cycle: 15 active room(s)
```
- **Quand**: Toutes les minutes (début du cycle de cleanup)
- **Info**: Nombre de rooms actives
- **Utilité**: Voir l'évolution du nombre de rooms

#### `[CLEANUP_INACTIVE_MEMBERS]`
```json
[CLEANUP_INACTIVE_MEMBERS] Room ABC123: Removed 2 inactive member(s)
{
  "roomCode": "ABC123",
  "roomAge": 1800,
  "remainingMembers": 1,
  "removedMembers": [
    {"id": "uuid-1", "name": "Bob", "inactiveDuration": 320},
    {"id": "uuid-2", "name": "Charlie", "inactiveDuration": 305}
  ]
}
```
- **Quand**: Des membres inactifs (>5min sans activité) sont supprimés
- **Info**: Qui a été supprimé, durée d'inactivité en secondes
- **Problème potentiel**: Si des membres actifs sont supprimés, c'est qu'ils ne mettent pas à jour leur `lastActivity`

#### `[CLEANUP_EMPTY_ROOM]`
```json
[CLEANUP_EMPTY_ROOM] Room ABC123: Deleting empty room past grace period
{
  "roomCode": "ABC123",
  "roomAge": 360,
  "gracePeriod": 300,
  "hadInactiveMembers": true
}
```
- **Quand**: Une room vide est supprimée (après 5min de grâce)
- **Info**: Âge de la room, période de grâce
- **Problème potentiel**: Si une room est supprimée trop rapidement, la période de grâce est peut-être trop courte

#### `[CLEANUP_EMPTY_ROOM_GRACE]`
```json
[CLEANUP_EMPTY_ROOM_GRACE] Room ABC123: Empty but within grace period, preserving room
{
  "roomCode": "ABC123",
  "roomAge": 120,
  "gracePeriod": 300
}
```
- **Quand**: Une room vide est préservée (dans la période de grâce)
- **Info**: Âge de la room, temps restant avant suppression

### 4. Server-Sent Events (SSE)

#### `[SSE_ROOM_DISAPPEARED]`
```json
[SSE_ROOM_DISAPPEARED] Room ABC123: Room disappeared during SSE keep-alive for member uuid-session-id
{
  "roomCode": "ABC123",
  "memberId": "uuid-session-id"
}
```
- **Quand**: Une room disparaît pendant qu'un client SSE est connecté
- **Info**: Room concernée, membre affecté
- **Problème critique**: C'est probablement le log le plus important pour votre problème!

#### `[SSE_MEMBER_DISAPPEARED]`
```json
[SSE_MEMBER_DISAPPEARED] Room ABC123: Member uuid-session-id no longer in room during SSE keep-alive
{
  "roomCode": "ABC123",
  "memberId": "uuid-session-id",
  "remainingMembers": 2
}
```
- **Quand**: Un membre n'est plus dans la room pendant le SSE keep-alive
- **Info**: Membre concerné, membres restants

## 🔍 Comment Déboguer un Problème de 404

### Scénario 1: Room disparaît soudainement

**Filtrer les logs pour une room spécifique:**
```bash
grep "ABC123" logs.txt
```

**Chronologie à rechercher:**
```
[ROOM_CREATED] Room ABC123 ...
[MEMBER_JOINED] Room ABC123: Member "Alice" ...
[MEMBER_JOINED] Room ABC123: Member "Bob" ...
...
[CLEANUP_INACTIVE_MEMBERS] Room ABC123: Removed 2 inactive member(s) ...
[CLEANUP_EMPTY_ROOM] Room ABC123: Deleting empty room ...
[ROOM_NOT_FOUND] Room ABC123 ...
```

**Diagnostic:**
1. Si vous voyez `[CLEANUP_INACTIVE_MEMBERS]` suivi de `[CLEANUP_EMPTY_ROOM]`: Les membres ont été marqués comme inactifs
2. Si l'`inactiveDuration` est autour de 300s (5min): C'est le comportement normal
3. Si l'`inactiveDuration` est très faible (<100s): Problème de mise à jour du `lastActivity`

### Scénario 2: Room disparaît pendant une session active

**Chercher les logs SSE:**
```bash
grep "\[SSE_" logs.txt
```

**Si vous voyez:**
```
[SSE_ROOM_DISAPPEARED] Room ABC123: Room disappeared during SSE keep-alive
```

**Cela signifie:**
- La room existait quand le client s'est connecté
- Elle a disparu entre deux keep-alive (max 30s)
- **Cause possible**: TTL Redis expiré, ou cleanup trop agressif

### Scénario 3: Tous les membres d'une room sont supprimés

**Chercher les suppressions de membres:**
```bash
grep "MEMBER.*ABC123" logs.txt
```

**Pattern à surveiller:**
```
[MEMBER_JOINED] Room ABC123: Member "Alice" joined
[CLEANUP_INACTIVE_MEMBERS] Room ABC123: Removed 1 inactive member(s)
  - Alice inactive for 305s
```

**Diagnostic:**
- Si Alice vient de rejoindre (<1min) mais est marquée inactive: Bug de `lastActivity`
- Si Alice est inactive depuis 5min+: Comportement normal

## 📊 Commandes Utiles pour Filtrer les Logs

### Voir toutes les rooms supprimées
```bash
grep "\[CLEANUP_EMPTY_ROOM\]" logs.txt
```

### Voir les membres supprimés pour inactivité
```bash
grep "\[CLEANUP_INACTIVE_MEMBERS\]" logs.txt
```

### Voir les rooms qui disparaissent pendant un SSE
```bash
grep "\[SSE_ROOM_DISAPPEARED\]" logs.txt
```

### Voir l'évolution du nombre de rooms actives
```bash
grep "\[CLEANUP_START\]" logs.txt
```

### Timeline complète d'une room
```bash
grep "ABC123" logs.txt | sort
```

### Voir les TTL faibles
```bash
grep "\[ROOM_TTL_WARNING\]" logs.txt
```

## 🎯 Actions Correctives Potentielles

Selon ce que vous trouvez dans les logs:

### Si les membres sont marqués inactifs trop vite
- Vérifier que le SSE keep-alive fonctionne (toutes les 30s)
- Vérifier que `lastActivity` est bien mis à jour lors des actions (vote, etc.)

### Si les rooms sont supprimées pendant qu'elles sont actives
- Vérifier le TTL Redis (actuellement 2h)
- Vérifier la période de grâce pour les rooms vides (actuellement 5min)

### Si les rooms disparaissent aléatoirement
- Vérifier la configuration Redis (persistence, maxmemory-policy)
- Vérifier si Redis évicte des clés (utiliser `INFO stats` sur Redis)

## 🔧 Configuration Actuelle

- **TTL Room**: 2 heures (7200s)
- **Inactivité membre**: 5 minutes (300s)
- **Période de grâce room vide**: 5 minutes (300s)
- **SSE keep-alive**: 30 secondes
- **Cleanup interval**: 1 minute

## 📝 Format JSON des Logs

Tous les logs incluent un objet JSON avec des détails structurés. Vous pouvez les parser avec `jq`:

```bash
# Extraire tous les logs avec JSON
grep -E '\{.*\}' logs.txt | jq '.'

# Trouver les membres avec inactiveDuration > 100s
grep "\[CLEANUP_INACTIVE_MEMBERS\]" logs.txt | grep -oP '\{.*\}' | jq 'select(.removedMembers[].inactiveDuration > 100)'
```