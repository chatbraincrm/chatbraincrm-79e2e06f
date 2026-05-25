import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWebChatConversations } from '@/hooks/useWebChat';
import {
  BarChart3, MessageSquare, Clock, Users, TrendingUp,
  UserCheck, Smile, Frown, Meh, GitMerge, CalendarDays,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function fmtMin(minutes: number) {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function pct(num: number, den: number) {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

function BarRow({
  label, value, max, color, suffix = '',
}: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-10 shrink-0 text-right text-muted-foreground text-xs">{label}</span>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${w}%`, background: color }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-medium tabular-nums text-xs">
        {value}{suffix}
      </span>
    </div>
  );
}

function MiniBar({
  value, max, color,
}: { value: number; max: number; color: string }) {
  const h = max > 0 ? Math.max(4, Math.round((value / max) * 56)) : 4;
  return (
    <div className="flex flex-col items-center justify-end h-14 gap-0.5">
      <div
        className="w-4 rounded-t transition-all duration-500"
        style={{ height: `${h}px`, background: color, opacity: value === 0 ? 0.2 : 1 }}
      />
    </div>
  );
}

// ─── main component ─────────────────────────────────────────────────────────

export function WebChatReportsTab() {
  const { data: allConversations, isLoading } = useWebChatConversations({ tab: 'all', limit: 500 });
  const [volumeView, setVolumeView] = useState<'hour' | 'day'>('day');

  const conversations = useMemo(() => allConversations || [], [allConversations]);

  // ── KPIs base ──────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = conversations.length;
    const active = conversations.filter(c =>
      ['bot_active', 'waiting_human', 'human_active'].includes(c.status)
    ).length;
    const waiting = conversations.filter(c => c.status === 'waiting_human').length;
    const closed = conversations.filter(c => c.status === 'closed').length;

    const withResponse = conversations.filter(c => c.first_response_at && c.created_at);
    const avgResponseMin = withResponse.length > 0
      ? withResponse.reduce((sum, c) => {
          return sum + (new Date(c.first_response_at!).getTime() - new Date(c.created_at).getTime());
        }, 0) / withResponse.length / 60000
      : 0;

    const botResolved = conversations.filter(c => c.status === 'closed' && !c.assigned_user_id).length;
    const botRate = pct(botResolved, closed);

    return { total, active, waiting, closed, avgResponseMin, botRate };
  }, [conversations]);

  // ── Volume por hora e por dia ──────────────────────────────────────────────
  const volumeByHour = useMemo(() => {
    const counts = Array(24).fill(0);
    conversations.forEach(c => {
      const h = new Date(c.created_at).getHours();
      counts[h]++;
    });
    return counts;
  }, [conversations]);

  const volumeByDay = useMemo(() => {
    const counts = Array(7).fill(0);
    conversations.forEach(c => {
      const d = new Date(c.created_at).getDay();
      counts[d]++;
    });
    return counts;
  }, [conversations]);

  const maxHour = Math.max(...volumeByHour, 1);
  const maxDay  = Math.max(...volumeByDay, 1);

  // ── Performance por atendente ──────────────────────────────────────────────
  const agentStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      handled: number;
      totalResponseMs: number;
      responseCount: number;
      leads: number;
      closed: number;
    }> = {};

    conversations.forEach(c => {
      if (!c.assigned_user_id) return;
      const id = c.assigned_user_id;
      const name = (c as any).profiles?.full_name || 'Atendente';
      if (!map[id]) map[id] = { name, handled: 0, totalResponseMs: 0, responseCount: 0, leads: 0, closed: 0 };
      map[id].handled++;
      if (c.lead_id) map[id].leads++;
      if (c.status === 'closed') map[id].closed++;
      if (c.first_response_at && c.created_at) {
        map[id].totalResponseMs += new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime();
        map[id].responseCount++;
      }
    });

    return Object.entries(map)
      .map(([id, s]) => ({
        id,
        name: s.name,
        handled: s.handled,
        avgResponseMin: s.responseCount > 0 ? s.totalResponseMs / s.responseCount / 60000 : 0,
        leads: s.leads,
        closed: s.closed,
        convRate: pct(s.leads, s.handled),
      }))
      .sort((a, b) => b.handled - a.handled);
  }, [conversations]);

  // ── Funil de conversão ────────────────────────────────────────────────────
  const funnel = useMemo(() => {
    const total      = conversations.length;
    const withData   = conversations.filter(c => c.data_collected).length;
    const withLead   = conversations.filter(c => !!c.lead_id).length;
    return { total, withData, withLead };
  }, [conversations]);

  // ── Leads gerados ─────────────────────────────────────────────────────────
  const leadsStats = useMemo(() => {
    const generated = conversations.filter(c => !!c.lead_id).length;
    const rate = pct(generated, conversations.length);

    // Últimos 7 dias agrupados
    const now = Date.now();
    const dayMs = 86400000;
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(now - (6 - i) * dayMs);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + dayMs);
      const label = dayStart.toLocaleDateString('pt-BR', { weekday: 'short' });
      const leads = conversations.filter(c => {
        const t = new Date(c.created_at).getTime();
        return !!c.lead_id && t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      return { label, leads };
    });
    return { generated, rate, days };
  }, [conversations]);

  const maxLeadsDay = Math.max(...leadsStats.days.map(d => d.leads), 1);

  // ── Sentimento heurístico ─────────────────────────────────────────────────
  const sentiment = useMemo(() => {
    // Positivo: lead gerado OU human_active + data_collected
    // Neutro:   bot resolveu sem lead, mas coletou dados
    // Negativo: fechado sem lead, sem dados coletados
    let pos = 0, neu = 0, neg = 0;
    conversations.forEach(c => {
      if (c.lead_id) {
        pos++;
      } else if (c.data_collected) {
        neu++;
      } else {
        neg++;
      }
    });
    const total = conversations.length || 1;
    return {
      positive: pos, positiveRate: pct(pos, total),
      neutral:  neu, neutralRate:  pct(neu, total),
      negative: neg, negativeRate: pct(neg, total),
    };
  }, [conversations]);

  // ── distribuição por status ───────────────────────────────────────────────
  const statusDist = useMemo(() => {
    const botActive    = conversations.filter(c => c.status === 'bot_active').length;
    const waitHuman    = conversations.filter(c => c.status === 'waiting_human').length;
    const humanActive  = conversations.filter(c => c.status === 'human_active').length;
    return { botActive, waitHuman, humanActive };
  }, [conversations]);

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.total}</div>
            <p className="text-xs text-muted-foreground">{kpi.active} ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Atendimento</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.waiting}</div>
            <p className="text-xs text-muted-foreground">visitantes na fila</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpi.avgResponseMin > 0 ? fmtMin(kpi.avgResponseMin) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">primeira resposta humana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolvido pelo Bot</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.botRate}%</div>
            <p className="text-xs text-muted-foreground">das conversas fechadas</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Status Breakdown ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Distribuição por Status
          </CardTitle>
          <CardDescription>Visão geral do estado das conversas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Com Bot',          val: statusDist.botActive,   color: 'hsl(var(--primary))',  total: kpi.total },
            { label: 'Aguardando Humano',val: statusDist.waitHuman,   color: '#EAB308',              total: kpi.total },
            { label: 'Em Atendimento',   val: statusDist.humanActive, color: '#22C55E',              total: kpi.total },
            { label: 'Fechadas',         val: kpi.closed,             color: '#6B7280',              total: kpi.total },
          ].map(({ label, val, color, total }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="font-medium">{val}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct(val, total)}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Volume por Hora / Dia ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Volume de Conversas
              </CardTitle>
              <CardDescription>Distribuição por hora do dia e dia da semana</CardDescription>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setVolumeView('day')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  volumeView === 'day'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                Por dia
              </button>
              <button
                onClick={() => setVolumeView('hour')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  volumeView === 'hour'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                Por hora
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {volumeView === 'day' ? (
            <div className="space-y-3">
              {DAYS.map((day, i) => (
                <BarRow
                  key={day}
                  label={day}
                  value={volumeByDay[i]}
                  max={maxDay}
                  color="hsl(var(--primary))"
                  suffix=" conv."
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* mini bars heatmap */}
              <div className="flex items-end gap-0.5 pt-2">
                {HOURS.map(h => (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1">
                    <MiniBar value={volumeByHour[h]} max={maxHour} color="hsl(var(--primary))" />
                    {h % 4 === 0 && (
                      <span className="text-[9px] text-muted-foreground">{h}h</span>
                    )}
                  </div>
                ))}
              </div>
              {/* top 5 hours */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">Top horários</p>
                {[...volumeByHour.map((v, i) => ({ h: i, v })).sort((a, b) => b.v - a.v).slice(0, 5)].map(({ h, v }) => (
                  <BarRow
                    key={h}
                    label={`${String(h).padStart(2,'0')}h`}
                    value={v}
                    max={maxHour}
                    color="hsl(var(--primary))"
                    suffix=" conv."
                  />
                ))}
              </div>
            </div>
          )}
          {conversations.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">Sem dados suficientes</p>
          )}
        </CardContent>
      </Card>

      {/* ── Performance por Atendente ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Performance por Atendente
          </CardTitle>
          <CardDescription>Conversas tratadas, tempo médio de resposta e taxa de conversão</CardDescription>
        </CardHeader>
        <CardContent>
          {agentStats.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma conversa foi transferida para atendente ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4 font-medium">Atendente</th>
                    <th className="text-right py-2 px-2 font-medium">Conversas</th>
                    <th className="text-right py-2 px-2 font-medium">Fechadas</th>
                    <th className="text-right py-2 px-2 font-medium">T. Resposta</th>
                    <th className="text-right py-2 px-2 font-medium">Leads</th>
                    <th className="text-right py-2 pl-2 font-medium">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium truncate max-w-[140px]">{a.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-2 tabular-nums">{a.handled}</td>
                      <td className="text-right py-2.5 px-2 tabular-nums text-muted-foreground">{a.closed}</td>
                      <td className="text-right py-2.5 px-2 tabular-nums">
                        {a.avgResponseMin > 0 ? fmtMin(a.avgResponseMin) : '--'}
                      </td>
                      <td className="text-right py-2.5 px-2 tabular-nums text-emerald-400">{a.leads}</td>
                      <td className="text-right py-2.5 pl-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs tabular-nums',
                            a.convRate >= 30 ? 'border-emerald-500/40 text-emerald-400' :
                            a.convRate >= 10 ? 'border-yellow-500/40 text-yellow-400' :
                            'border-border text-muted-foreground'
                          )}
                        >
                          {a.convRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Leads gerados + Funil ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Leads por dia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Leads Gerados via Chat
            </CardTitle>
            <CardDescription>
              {leadsStats.generated} leads nos dados carregados —{' '}
              taxa de {leadsStats.rate}% de conversão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20 mb-3">
              {leadsStats.days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t transition-all duration-500 bg-emerald-500"
                    style={{
                      height: `${Math.max(4, Math.round((d.leads / maxLeadsDay) * 64))}px`,
                      opacity: d.leads === 0 ? 0.2 : 1,
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400">{leadsStats.generated}</p>
                <p className="text-[10px] text-muted-foreground">Total leads</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{leadsStats.rate}%</p>
                <p className="text-[10px] text-muted-foreground">Taxa de conv.</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{kpi.total}</p>
                <p className="text-[10px] text-muted-foreground">Total chats</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funil de conversão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Funil Chat → Lead
            </CardTitle>
            <CardDescription>Taxa de conversão em cada etapa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {[
              { label: 'Iniciaram conversa', value: funnel.total,    color: 'hsl(var(--primary))',     pctVal: 100 },
              { label: 'Dados coletados',     value: funnel.withData, color: '#F59E0B',                pctVal: pct(funnel.withData, funnel.total) },
              { label: 'Lead gerado',          value: funnel.withLead, color: '#22C55E',               pctVal: pct(funnel.withLead, funnel.total) },
            ].map(({ label, value, color, pctVal }, i) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span>{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{value}</span>
                    <Badge variant="outline" className="text-[10px] tabular-nums" style={{ borderColor: `${color}40`, color }}>
                      {pctVal}%
                    </Badge>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pctVal}%`, background: color }}
                  />
                </div>
              </div>
            ))}
            {funnel.total > 0 && funnel.withLead > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                Drop-off principal:{' '}
                <span className="text-foreground font-medium">
                  {funnel.withData - funnel.withLead} leads perdidos após coleta de dados
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Análise de Sentimento ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            Análise de Sentimento das Conversas
          </CardTitle>
          <CardDescription>
            Heurística baseada em outcomes: lead gerado (positivo), dados coletados sem lead (neutro),
            sem engajamento (negativo)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center space-y-1">
              <Smile className="h-6 w-6 text-emerald-400 mx-auto" />
              <p className="text-2xl font-bold text-emerald-400">{sentiment.positiveRate}%</p>
              <p className="text-xs text-muted-foreground">Positivo</p>
              <p className="text-xs text-emerald-400/70">{sentiment.positive} conversas</p>
            </div>
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center space-y-1">
              <Meh className="h-6 w-6 text-yellow-400 mx-auto" />
              <p className="text-2xl font-bold text-yellow-400">{sentiment.neutralRate}%</p>
              <p className="text-xs text-muted-foreground">Neutro</p>
              <p className="text-xs text-yellow-400/70">{sentiment.neutral} conversas</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center space-y-1">
              <Frown className="h-6 w-6 text-red-400 mx-auto" />
              <p className="text-2xl font-bold text-red-400">{sentiment.negativeRate}%</p>
              <p className="text-xs text-muted-foreground">Negativo</p>
              <p className="text-xs text-red-400/70">{sentiment.negative} conversas</p>
            </div>
          </div>

          {/* barra empilhada */}
          <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
            {sentiment.positiveRate > 0 && (
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${sentiment.positiveRate}%` }} />
            )}
            {sentiment.neutralRate > 0 && (
              <div className="h-full bg-yellow-500 transition-all" style={{ width: `${sentiment.neutralRate}%` }} />
            )}
            {sentiment.negativeRate > 0 && (
              <div className="h-full bg-red-500 transition-all" style={{ width: `${sentiment.negativeRate}%` }} />
            )}
          </div>

          {conversations.length === 0 && (
            <p className="text-center text-sm text-muted-foreground pt-4">
              Nenhuma conversa registrada ainda.
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
