import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RotateCcw, Thermometer, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Rules {
  hot_threshold: number;
  cold_threshold: number;
  weight_bant: number;
  weight_recency: number;
  weight_engagement: number;
  weight_stage: number;
  recency_cold_after_days: number;
  engagement_full_at_messages: number;
}

const DEFAULTS: Rules = {
  hot_threshold: 70,
  cold_threshold: 35,
  weight_bant: 40,
  weight_recency: 25,
  weight_engagement: 15,
  weight_stage: 20,
  recency_cold_after_days: 14,
  engagement_full_at_messages: 20,
};

export function LeadTemperatureRulesManager() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [rules, setRules] = useState<Rules>(DEFAULTS);

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_temperature_rules')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (!error && data) {
        setRules({
          hot_threshold: data.hot_threshold,
          cold_threshold: data.cold_threshold,
          weight_bant: data.weight_bant,
          weight_recency: data.weight_recency,
          weight_engagement: data.weight_engagement,
          weight_stage: data.weight_stage,
          recency_cold_after_days: data.recency_cold_after_days,
          engagement_full_at_messages: data.engagement_full_at_messages,
        });
      }
      setLoading(false);
    })();
  }, [orgId]);

  const weightSum =
    rules.weight_bant + rules.weight_recency + rules.weight_engagement + rules.weight_stage;

  const update = <K extends keyof Rules>(key: K, value: Rules[K]) =>
    setRules((r) => ({ ...r, [key]: value }));

  const handleSave = async () => {
    if (!orgId) return;
    if (rules.cold_threshold >= rules.hot_threshold) {
      toast({
        title: 'Limiares inválidos',
        description: 'O limiar de frio precisa ser menor que o de quente.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('lead_temperature_rules')
      .upsert({ organization_id: orgId, ...rules }, { onConflict: 'organization_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Regras salvas', description: 'As mudanças entram em vigor no próximo recálculo.' });
  };

  const handleRecompute = async () => {
    if (!orgId) return;
    setRecomputing(true);
    const { data, error } = await supabase.rpc('recompute_org_temperatures', {
      _organization_id: orgId,
    });
    setRecomputing(false);
    if (error) {
      toast({ title: 'Erro no recálculo', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Temperaturas recalculadas',
      description: `${data ?? 0} leads atualizados.`,
    });
  };

  const handleReset = () => setRules(DEFAULTS);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Thermometer className="h-6 w-6 text-primary" />
            Temperatura do Lead
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure como o sistema classifica cada lead como <Badge variant="outline" className="text-emerald-600">quente</Badge>,
            <Badge variant="outline" className="ml-1 text-amber-600">morno</Badge> ou
            <Badge variant="outline" className="ml-1 text-sky-600">frio</Badge>. O cálculo é automático,
            mas vendedores podem fixar manualmente no card do lead.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Limiares de classificação</CardTitle>
          <CardDescription>
            O score final vai de 0 a 100. Acima do limiar de quente = quente. Abaixo do limiar de frio = frio. Entre os dois = morno.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Limiar para quente</Label>
              <span className="text-sm font-mono font-medium text-emerald-600">
                ≥ {rules.hot_threshold} pts
              </span>
            </div>
            <Slider
              value={[rules.hot_threshold]}
              onValueChange={([v]) => update('hot_threshold', v)}
              min={1}
              max={100}
              step={1}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Limiar para frio</Label>
              <span className="text-sm font-mono font-medium text-sky-600">
                &lt; {rules.cold_threshold} pts
              </span>
            </div>
            <Slider
              value={[rules.cold_threshold]}
              onValueChange={([v]) => update('cold_threshold', v)}
              min={0}
              max={99}
              step={1}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pesos dos sinais</CardTitle>
          <CardDescription>
            Defina o quanto cada sinal contribui no score. Não precisa somar 100 — o sistema normaliza.
            Soma atual: <span className="font-mono font-medium">{weightSum}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {([
            ['weight_bant', 'Score BANT (Budget / Authority / Need / Timing)'],
            ['weight_recency', 'Recência do último contato'],
            ['weight_engagement', 'Engajamento (mensagens recebidas)'],
            ['weight_stage', 'Estágio no pipeline'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <Label>{label}</Label>
                <span className="text-sm font-mono font-medium text-foreground">
                  {rules[key]} pts
                </span>
              </div>
              <Slider
                value={[rules[key]]}
                onValueChange={([v]) => update(key, v)}
                min={0}
                max={100}
                step={1}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros de decay</CardTitle>
          <CardDescription>Como recência e engajamento são pontuados.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-6">
          <div>
            <Label className="mb-2 block">Lead esfria após (dias sem contato)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={rules.recency_cold_after_days}
              onChange={(e) => update('recency_cold_after_days', Math.max(1, Number(e.target.value)))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pontuação cai linearmente de 100% (≤24h) até 0% nesse prazo.
            </p>
          </div>
          <div>
            <Label className="mb-2 block">Engajamento máximo em (mensagens)</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={rules.engagement_full_at_messages}
              onChange={(e) =>
                update('engagement_full_at_messages', Math.max(1, Number(e.target.value)))
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quantas mensagens recebidas equivalem a 100% do peso de engajamento.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={handleReset} disabled={saving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar padrão
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRecompute}
            disabled={recomputing || saving}
          >
            {recomputing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Recalcular todos os leads
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar regras
          </Button>
        </div>
      </div>
    </div>
  );
}
