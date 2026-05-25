import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, startOfWeek, addDays, subDays } from 'date-fns';

export function useDashboardData(productId: string, userId?: string) {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  // Fetch leads with stage info for funnel and conversion
  const leadsQuery = useQuery({
    queryKey: ['dashboard-leads', productId, userId],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          id,
          name,
          company,
          temperature,
          last_contact_at,
          created_at,
          current_stage_id,
          pipeline_stages!leads_current_stage_id_fkey (
            id, name, color, order_index, is_won, is_lost
          )
        `)
        .eq('product_id', productId);

      if (userId) {
        query = query.eq('assigned_to', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  // Fetch pipeline stages for funnel
  const stagesQuery = useQuery({
    queryKey: ['dashboard-stages', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('product_id', productId)
        .order('order_index');

      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  // Fetch commissions for chart
  const commissionsQuery = useQuery({
    queryKey: ['dashboard-commissions', productId, userId],
    queryFn: async () => {
      let query = supabase
        .from('commissions')
        .select('id, amount, created_at, status')
        .eq('product_id', productId);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  // Fetch deals for stats
  const dealsQuery = useQuery({
    queryKey: ['dashboard-deals', productId, userId],
    queryFn: async () => {
      let query = supabase
        .from('deals')
        .select('id, deal_value, status, closed_at')
        .eq('product_id', productId);

      if (userId) {
        query = query.eq('seller_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  // Process funnel data
  const funnelData = () => {
    if (!stagesQuery.data || !leadsQuery.data) return [];

    const activeStages = stagesQuery.data.filter(s => !s.is_won && !s.is_lost);
    
    return activeStages.map(stage => {
      const count = leadsQuery.data.filter(l => l.current_stage_id === stage.id).length;
      return {
        name: stage.name,
        count,
        color: stage.color || '#6B7280',
      };
    });
  };

  // Process conversion data
  const conversionData = () => {
    if (!leadsQuery.data || !stagesQuery.data) {
      return { totalLeads: 0, wonLeads: 0, lostLeads: 0, activeLeads: 0 };
    }

    const wonStageIds = stagesQuery.data.filter(s => s.is_won).map(s => s.id);
    const lostStageIds = stagesQuery.data.filter(s => s.is_lost).map(s => s.id);

    const wonLeads = leadsQuery.data.filter(l => wonStageIds.includes(l.current_stage_id || '')).length;
    const lostLeads = leadsQuery.data.filter(l => lostStageIds.includes(l.current_stage_id || '')).length;
    const activeLeads = leadsQuery.data.filter(l => 
      l.current_stage_id && 
      !wonStageIds.includes(l.current_stage_id) && 
      !lostStageIds.includes(l.current_stage_id)
    ).length;

    return {
      totalLeads: leadsQuery.data.length,
      wonLeads,
      lostLeads,
      activeLeads,
    };
  };

  // Stats calculations
  const stats = () => {
    const leads = leadsQuery.data || [];
    const deals = dealsQuery.data || [];
    const commissions = commissionsQuery.data || [];
    const stages = stagesQuery.data || [];

    const activeLeadsCount = leads.filter(l => {
      const stage = stages.find(s => s.id === l.current_stage_id);
      return stage && !stage.is_won && !stage.is_lost;
    }).length;

    const wonDeals = deals.filter(d => d.status === 'won');
    const lostDeals = deals.filter(d => d.status === 'lost');
    const closedDeals = wonDeals.length + lostDeals.length;
    const conversionRate = closedDeals > 0 ? Math.round((wonDeals.length / closedDeals) * 100) : 0;

    const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingCommissions = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);

    // Calculate at-risk leads (no contact in 3+ days)
    const now = new Date();
    const atRiskLeads = leads.filter(lead => {
      const stage = stages.find(s => s.id === lead.current_stage_id);
      if (!stage || stage.is_won || stage.is_lost) return false;
      
      if (!lead.last_contact_at) return true;
      
      const lastContact = new Date(lead.last_contact_at);
      const daysDiff = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 3;
    }).map(lead => ({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      daysWithoutContact: lead.last_contact_at 
        ? Math.floor((now.getTime() - new Date(lead.last_contact_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999,
    })).sort((a, b) => b.daysWithoutContact - a.daysWithoutContact).slice(0, 5);

    return {
      activeLeadsCount,
      conversionRate,
      totalCommissions,
      pendingCommissions,
      wonDealsCount: wonDeals.length,
      wonDealsValue: wonDeals.reduce((sum, d) => sum + d.deal_value, 0),
      atRiskLeads,
    };
  };

  // Calculate trends — 100% dados reais, zero Math.random()
  const trends = () => {
    const deals = dealsQuery.data || [];
    const leads = leadsQuery.data || [];
    const commissions = commissionsQuery.data || [];

    // ── Leads: novos leads criados este mês vs mês anterior ──────────────────
    const thisMonthLeads = leads.filter(l => {
      const d = new Date((l as any).created_at);
      return d >= currentMonthStart && d <= currentMonthEnd;
    }).length;
    const lastMonthLeads = leads.filter(l => {
      const d = new Date((l as any).created_at);
      return d >= lastMonthStart && d <= lastMonthEnd;
    }).length;
    const leadsChange = lastMonthLeads > 0
      ? Math.round(((thisMonthLeads - lastMonthLeads) / lastMonthLeads) * 100)
      : thisMonthLeads > 0 ? 100 : 0;

    // ── Receita: valor de deals ganhos este mês vs mês anterior ──────────────
    const inMonth = (dateStr: string | null, start: Date, end: Date) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= start && d <= end;
    };
    const thisMonthWon  = deals.filter(d => d.status === 'won' && inMonth(d.closed_at, currentMonthStart, currentMonthEnd));
    const lastMonthWon  = deals.filter(d => d.status === 'won' && inMonth(d.closed_at, lastMonthStart, lastMonthEnd));
    const thisRevenue   = thisMonthWon.reduce((s, d) => s + d.deal_value, 0);
    const lastRevenue   = lastMonthWon.reduce((s, d) => s + d.deal_value, 0);
    const revenueChange = lastRevenue > 0
      ? Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 100)
      : thisRevenue > 0 ? 100 : 0;

    // ── Conversão: taxa de deals ganhos/fechados este mês vs mês anterior ────
    const thisMonthClosed = deals.filter(d => inMonth(d.closed_at, currentMonthStart, currentMonthEnd));
    const lastMonthClosed = deals.filter(d => inMonth(d.closed_at, lastMonthStart, lastMonthEnd));
    const thisConv  = thisMonthClosed.length > 0 ? (thisMonthWon.length / thisMonthClosed.length) * 100 : 0;
    const lastConvWon = lastMonthClosed.filter(d => d.status === 'won').length;
    const lastConv  = lastMonthClosed.length > 0 ? (lastConvWon / lastMonthClosed.length) * 100 : 0;
    const conversionChange = lastConv > 0 ? Math.round(thisConv - lastConv) : 0;

    // ── Comissões: total gerado este mês vs mês anterior ─────────────────────
    const thisMonthComm = commissions
      .filter(c => inMonth(c.created_at, currentMonthStart, currentMonthEnd))
      .reduce((s, c) => s + c.amount, 0);
    const lastMonthComm = commissions
      .filter(c => inMonth(c.created_at, lastMonthStart, lastMonthEnd))
      .reduce((s, c) => s + c.amount, 0);
    const commissionsChange = lastMonthComm > 0
      ? Math.round(((thisMonthComm - lastMonthComm) / lastMonthComm) * 100)
      : thisMonthComm > 0 ? 100 : 0;

    return { leadsChange, conversionChange, revenueChange, commissionsChange };
  };

  // Weekly data for chart
  const weeklyData = () => {
    const deals = dealsQuery.data || [];
    const data: { date: string; deals: number; value: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateStr = format(date, 'yyyy-MM-dd');

      const dayDeals = deals.filter(d => {
        if (!d.closed_at) return false;
        return format(new Date(d.closed_at), 'yyyy-MM-dd') === dateStr && d.status === 'won';
      });

      data.push({
        date: dateStr,
        deals: dayDeals.length,
        value: dayDeals.reduce((sum, d) => sum + d.deal_value, 0),
      });
    }

    return data;
  };

  // Sparklines — dados reais dos últimos 7 dias (sem Math.random)
  const buildSparklines = () => {
    const deals = dealsQuery.data || [];
    const leads = leadsQuery.data || [];
    const commissions = commissionsQuery.data || [];

    const days7 = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, 6 - i);
      return format(d, 'yyyy-MM-dd');
    });

    const sparkLeads = days7.map(day =>
      leads.filter(l => format(new Date((l as any).created_at), 'yyyy-MM-dd') === day).length
    );

    const sparkRevenue = days7.map(day =>
      deals
        .filter(d => d.status === 'won' && d.closed_at && format(new Date(d.closed_at), 'yyyy-MM-dd') === day)
        .reduce((s, d) => s + d.deal_value / 1000, 0)
    );

    const sparkCommissions = days7.map(day =>
      commissions
        .filter(c => c.created_at && format(new Date(c.created_at), 'yyyy-MM-dd') === day)
        .reduce((s, c) => s + c.amount / 100, 0)
    );

    // Conversão: acumulado até cada dia (rolling 7d)
    const sparkConversion = days7.map((_, idx) => {
      const window = deals.filter(d => {
        if (!d.closed_at) return false;
        const dayIdx = days7.indexOf(format(new Date(d.closed_at), 'yyyy-MM-dd'));
        return dayIdx >= 0 && dayIdx <= idx;
      });
      const won = window.filter(d => d.status === 'won').length;
      return window.length > 0 ? Math.round((won / window.length) * 100) : 0;
    });

    return {
      leads: sparkLeads,
      revenue: sparkRevenue,
      commissions: sparkCommissions,
      conversion: sparkConversion,
    };
  };

  const currentStats = stats();
  const currentTrends = trends();
  const currentSparklines = buildSparklines();

  return {
    funnelData: funnelData(),
    conversionData: conversionData(),
    commissions: commissionsQuery.data || [],
    stats: currentStats,
    trends: currentTrends,
    weeklyData: weeklyData(),
    sparklineData: currentSparklines,
    isLoading: leadsQuery.isLoading || stagesQuery.isLoading || commissionsQuery.isLoading || dealsQuery.isLoading,
  };
}
