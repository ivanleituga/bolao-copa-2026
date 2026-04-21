// ============================================================
// Bolão Copa 2026 - Cálculo de classificação da fase de grupos
// ============================================================
// Recebe os times e jogos de UM grupo e retorna o array ordenado
// pelos critérios oficiais da FIFA (Artigo 13 do regulamento).
//
// Ordem dos critérios:
//   PASSO 1 — Confronto direto entre os empatados em pontos:
//     a) pontos nos jogos entre eles
//     b) saldo de gols nos jogos entre eles
//     c) gols marcados nos jogos entre eles
//
//   PASSO 2 — Se ainda há empate após a) b) c), reaplica a) b) c)
//   apenas entre os times que continuam empatados (recursão).
//   Se mesmo assim não separa, cai pros critérios gerais:
//     d) saldo de gols em todos os jogos do grupo
//     e) gols marcados em todos os jogos do grupo
//     f) fair play (cartões) — NÃO aplicado aqui, ver decisão abaixo
//
//   PASSO 3 — Ranking FIFA. Também NÃO aplicado.
//
// Decisões do projeto:
//   - Cartões não são inputados, então fair play não entra.
//   - Ranking FIFA também não é consultado.
//   - Tiebreaker final: ordem alfabética (determinístico).
//
// IMPORTANTE: esta tabela é apenas INFORMATIVA. A definição real
// de quem avança pro mata-mata é feita manualmente pelo admin.
// ============================================================

/**
 * Calcula os stats de um time a partir de uma lista de matches.
 * Ignora jogos sem resultado (scheduled, live, ou sem score).
 */
function computeTeamStats(teamId, matches) {
  const finished = matches.filter(
    (m) =>
      m.status === 'finished' &&
      m.home_score != null &&
      m.away_score != null &&
      (m.home_team_id === teamId || m.away_team_id === teamId)
  )

  let played = 0
  let won = 0
  let drawn = 0
  let lost = 0
  let goalsFor = 0
  let goalsAgainst = 0

  finished.forEach((m) => {
    played++
    const isHome = m.home_team_id === teamId
    const teamScore = isHome ? m.home_score : m.away_score
    const oppScore = isHome ? m.away_score : m.home_score

    goalsFor += teamScore
    goalsAgainst += oppScore

    if (teamScore > oppScore) won++
    else if (teamScore < oppScore) lost++
    else drawn++
  })

  return {
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    points: won * 3 + drawn,
  }
}

/**
 * Comparador de stats: pontos → saldo → gols.
 * Retorna 0 quando os três são iguais (empate).
 * Usado tanto pra stats gerais quanto pra stats de H2H.
 */
function compareStats(a, b) {
  if (b.points !== a.points) return b.points - a.points
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
  return 0
}

/**
 * Fallback quando o H2H não consegue separar um grupo de times.
 * Aplica (nesta ordem): saldo geral → gols gerais → alfabético.
 *
 * Os parâmetros já vêm com goalDiff, goalsFor calculados dos
 * stats gerais do grupo.
 */
function fallbackByOverallStats(tiedTeams) {
  return [...tiedTeams].sort((a, b) => {
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return a.team.name.localeCompare(b.team.name)
  })
}

/**
 * Resolve um grupo de times empatados em pontos, aplicando:
 *   1. Confronto direto (H2H)
 *   2. Se sobrarem subgrupos empatados no H2H, recursão neles
 *   3. Se o grupo inteiro continuar empatado após H2H, cai pro
 *      fallback por stats gerais.
 */
function resolveTiedGroup(tiedTeams, allMatches) {
  // Caso trivial: grupo de 1 time, nada pra resolver
  if (tiedTeams.length === 1) return tiedTeams

  // Filtra apenas matches finalizados entre os times empatados
  const tiedIds = new Set(tiedTeams.map((t) => t.team.id))
  const h2hMatches = allMatches.filter(
    (m) =>
      m.status === 'finished' &&
      m.home_score != null &&
      m.away_score != null &&
      tiedIds.has(m.home_team_id) &&
      tiedIds.has(m.away_team_id)
  )

  // Se nenhum jogo entre eles foi finalizado, H2H não se aplica:
  // cai direto pro fallback
  if (h2hMatches.length === 0) {
    return fallbackByOverallStats(tiedTeams)
  }

  // Calcula stats de cada time considerando só os matches entre empatados.
  // Guarda em `h2h` pra não sobrescrever os stats gerais.
  const withH2H = tiedTeams.map((t) => ({
    ...t,
    h2h: computeTeamStats(t.team.id, h2hMatches),
  }))

  // Ordena pelos critérios H2H
  withH2H.sort((a, b) => compareStats(a.h2h, b.h2h))

  // Percorre agrupando quem continua empatado mesmo depois do H2H
  const result = []
  let i = 0
  while (i < withH2H.length) {
    let j = i + 1
    while (
      j < withH2H.length &&
      compareStats(withH2H[j].h2h, withH2H[i].h2h) === 0
    ) {
      j++
    }

    if (j - i === 1) {
      // Time isolado, o H2H o separou
      result.push(withH2H[i])
    } else if (j - i === tiedTeams.length) {
      // GUARD: o "subgrupo" tem o mesmo tamanho do grupo original.
      // Ou seja, o H2H não separou NINGUÉM. Recursão ia gerar loop
      // infinito. Cai pro fallback por stats gerais.
      result.push(...fallbackByOverallStats(tiedTeams))
    } else {
      // Subgrupo parcial empatado no H2H → reaplica H2H só entre eles
      // (esse é o Passo 2 do Artigo 13 da FIFA)
      const subgroup = withH2H.slice(i, j)
      result.push(...resolveTiedGroup(subgroup, allMatches))
    }
    i = j
  }

  return result
}

/**
 * Função principal — recebe os times do grupo + os matches do grupo
 * e retorna array ordenado pela classificação da FIFA.
 *
 * Cada item do array tem:
 *   { team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points }
 */
export function calculateStandings(teams, matches) {
  // 1. Calcula stats gerais de cada time
  const withStats = teams.map((team) => ({
    team,
    ...computeTeamStats(team.id, matches),
  }))

  // 2. Ordena SÓ por pontos inicialmente.
  //    Os critérios de desempate são aplicados depois, por grupo de
  //    times com pontos iguais.
  withStats.sort((a, b) => b.points - a.points)

  // 3. Agrupa times com pontos iguais e aplica resolveTiedGroup em cada grupo
  const result = []
  let i = 0
  while (i < withStats.length) {
    let j = i + 1
    while (j < withStats.length && withStats[j].points === withStats[i].points) {
      j++
    }

    if (j - i === 1) {
      result.push(withStats[i])
    } else {
      const tied = withStats.slice(i, j)
      result.push(...resolveTiedGroup(tied, matches))
    }
    i = j
  }

  return result
}