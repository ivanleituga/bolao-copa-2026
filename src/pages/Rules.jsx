export default function Rules() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Regulamento
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      <div className="space-y-4">
        {/* Resumo */}
        <Section title="Como funciona">
          <p>
            Cada participante dá seus palpites para todos os jogos da Copa do Mundo 2026.
            Os palpites podem ser alterados até <strong>5 minutos antes</strong> do início
            de cada partida. Após esse prazo, o palpite é travado.
          </p>
        </Section>

        {/* Premiação */}
        <Section title="Premiação">
          <div className="space-y-5">
            {/* Resumo de valores */}
            <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700/30">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">
                    Entrada
                  </p>
                  <p className="text-white font-bold text-base">R$ 200</p>
                  <p className="text-gray-500 text-[10px]">por participante</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">
                    Premiação total
                  </p>
                  <p className="text-yellow-400 font-bold text-base">R$ 7.500</p>
                  <p className="text-gray-500 text-[10px]">
                    R$ 7.000 das entradas + R$ 500 dos últimos
                  </p>
                </div>
              </div>
            </div>

            {/* Top 8 — quem ganha */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                🏆 Top 8 — Quem ganha
              </p>

              {/* Pódio em destaque (com espaço entre cada linha) */}
              <div className="space-y-1.5 mb-3">
                <PodiumRow position="🥇 Campeão" prize="R$ 2.500" color="text-yellow-300" />
                <PodiumRow position="🥈 Vice" prize="R$ 1.700" color="text-slate-100" />
                <PodiumRow position="🥉 3º lugar" prize="R$ 1.150" color="text-amber-400" />
              </div>

              {/* Top 4-8 (tabela compacta) */}
              <table className="w-full text-sm">
                <tbody>
                  <PrizeRow position="4º lugar" prize="R$ 700" color="text-blue-300" />
                  <PrizeRow position="5º lugar" prize="R$ 500" color="text-blue-300" />
                  <PrizeRow position="6º lugar" prize="R$ 400" color="text-blue-300" />
                  <PrizeRow position="7º lugar" prize="R$ 300" color="text-blue-300" />
                  <PrizeRow position="8º lugar" prize="R$ 250" color="text-blue-300" />
                </tbody>
              </table>
            </div>

            {/* Últimos 4 — pagamento extra */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                📉 Últimos 4 — Pagamento extra
              </p>

              {/* 32º a 34º (compacto) */}
              <table className="w-full text-sm mb-3">
                <tbody>
                  <PrizeRow position="32º lugar" prize="+ R$ 50" color="text-red-400/80" />
                  <PrizeRow position="33º lugar" prize="+ R$ 100" color="text-red-400/80" />
                  <PrizeRow position="34º lugar" prize="+ R$ 150" color="text-red-400/80" />
                </tbody>
              </table>

              {/* Lanterna em destaque */}
              <PodiumRow position="💀 Lanterna" prize="+ R$ 200" color="text-red-300" isLast />

              <p className="text-gray-500 text-xs mt-3 italic">
                O pagamento extra dos últimos 4 colocados é além da taxa de entrada de R$ 200.
              </p>
            </div>
          </div>
        </Section>

        {/* Pontuação - apostando em vitória */}
        <Section title="Pontuação — apostando em vitória">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  Acerto
                </th>
                <th className="text-center py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider w-16">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <PointRow pts={15} label="Placar exato" example="Palpite 2×1, resultado 2×1" color="text-green-400" />
              <PointRow pts={11} label="Vencedor + diferença de gols" example="Palpite 3×1, resultado 2×0 (diferença de 2)" />
              <PointRow pts={9} label="Vencedor + gols de um time" example="Palpite 2×1, resultado 2×0 (gols do vencedor) ou 3×1 (gols do perdedor)" />
              <PointRow pts={7} label="Apenas o vencedor" example="Palpite 2×1, resultado 3×0" />
            </tbody>
          </table>
        </Section>

        {/* Pontuação - apostando em empate */}
        <Section title="Pontuação — apostando em empate">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  Acerto
                </th>
                <th className="text-center py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider w-16">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <PointRow pts={15} label="Placar exato" example="Palpite 1×1, resultado 1×1" color="text-green-400" />
              <PointRow pts={7} label="Empate não exato" example="Palpite 1×1, resultado 0×0 ou 2×2" />
              <PointRow pts={2} label="Palpite estimulado" example="Palpite 1×1, resultado 2×1 — você apostou no empate mas houve um vencedor" />
            </tbody>
          </table>
        </Section>

        {/* Multiplicadores */}
        <Section title="Multiplicadores por fase">
          <p className="mb-3">
            A pontuação base é multiplicada de acordo com a fase do torneio.
            Quanto mais avançada a fase, mais valem os palpites.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  Fase
                </th>
                <th className="text-center py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider w-20">
                  Multi
                </th>
                <th className="text-left py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  Exemplo (cravada)
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <MultRow fase="Fase de grupos" multi="×1" exemplo="15 pts" />
              <MultRow fase="16 avos de final" multi="×2" exemplo="30 pts" />
              <MultRow fase="Oitavas de final" multi="×3" exemplo="45 pts" />
              <MultRow fase="Quartas de final" multi="×4" exemplo="60 pts" />
              <MultRow fase="Semifinal" multi="×5" exemplo="75 pts" />
              <MultRow fase="3º lugar" multi="×5" exemplo="75 pts" />
              <MultRow fase="Final" multi="×6" exemplo="90 pts" />
            </tbody>
          </table>
        </Section>

        {/* Perguntas especiais */}
        <Section title="Perguntas especiais">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  Pergunta
                </th>
                <th className="text-center py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider w-16">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800/60">
                <td className="py-2.5">Quem será o campeão?</td>
                <td className="py-2.5 text-center font-bold text-white">50</td>
              </tr>
              <tr>
                <td className="py-2.5">Quem será o artilheiro?</td>
                <td className="py-2.5 text-center font-bold text-white">50</td>
              </tr>
            </tbody>
          </table>
          <p className="text-gray-500 text-xs mt-2">
            As perguntas especiais devem ser respondidas antes do primeiro jogo da Copa.
          </p>
        </Section>

        {/* Critérios de desempate */}
        <Section title="Critérios de desempate">
          <ol className="text-gray-300 text-sm space-y-1.5 list-decimal list-inside">
            <li>Maior número de pontos totais</li>
            <li>Maior número de cravadas (placares exatos)</li>
            <li>Maior número de acertos (palpites com pontuação {'>'} 0)</li>
          </ol>
        </Section>

        {/* Regras gerais */}
        <Section title="Regras gerais">
          <ul className="text-gray-300 text-sm space-y-1.5 list-disc list-inside">
            <li>Palpites são editáveis até 5 minutos antes do início da partida</li>
            <li>Após o prazo, o palpite é travado e não pode ser alterado</li>
            <li>Jogos sem palpite não pontuam</li>
            <li>Em caso de prorrogação, vale o placar do tempo regulamentar (90 minutos)</li>
            <li>Todos os palpites são visíveis para os demais participantes após o início do jogo</li>
          </ul>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-gray-800/80 rounded-xl border border-gray-700/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700/40">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="px-4 py-3 text-sm text-gray-300 leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function PointRow({ pts, label, example, color = 'text-white' }) {
  return (
    <tr className="border-b border-gray-800/60 last:border-0">
      <td className="py-2.5">
        <span className="block text-white">{label}</span>
        <span className="block text-gray-500 text-xs mt-0.5">{example}</span>
      </td>
      <td className={`py-2.5 text-center font-bold ${color}`}>{pts}</td>
    </tr>
  )
}

function MultRow({ fase, multi, exemplo }) {
  return (
    <tr className="border-b border-gray-800/60 last:border-0">
      <td className="py-2.5 text-white">{fase}</td>
      <td className="py-2.5 text-center font-bold text-yellow-400">{multi}</td>
      <td className="py-2.5 text-gray-400">{exemplo}</td>
    </tr>
  )
}

/**
 * PodiumRow — linha em destaque pra Campeão/Vice/3º/Lanterna.
 * Card próprio, padding maior, espaçamento entre cards garantido
 * pelo space-y do container.
 */
function PodiumRow({ position, prize, color, isLast = false }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border
        ${isLast
          ? 'bg-red-900/20 border-red-700/40'
          : 'bg-gray-900/40 border-gray-700/40'}`}
    >
      <span className={`font-bold ${color}`}>
        {position}
      </span>
      <span className={`font-bold text-base tabular-nums ${color}`}>
        {prize}
      </span>
    </div>
  )
}

/**
 * PrizeRow — linha simples de tabela pra posições 4-8 e 32-34.
 */
function PrizeRow({ position, prize, color = 'text-white' }) {
  return (
    <tr className="border-b border-gray-800/60 last:border-0">
      <td className={`py-2.5 ${color}`}>
        {position}
      </td>
      <td className={`py-2.5 text-right tabular-nums font-semibold ${color}`}>
        {prize}
      </td>
    </tr>
  )
}