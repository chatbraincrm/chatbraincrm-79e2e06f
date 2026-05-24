import { useState } from 'react';
import { useLeads, usePipelineStages, useMoveLead, useCreateLead } from '@/hooks/useLeads';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { DealModal } from '@/components/seller/DealModal';
import { LeadDetailPage } from '@/components/lead/LeadDetailPage';
import { SquadQueueBanner } from '@/components/seller/SquadQueueBanner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { computeBantScore, getBantTier } from '@/lib/bantScore';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  User, 
  Building, 
  Phone, 
  Mail,
  GripVertical,
  Calendar,
  Flame,
  Snowflake,
  ThermometerSun,
  Loader2,
  Eye,
  DollarSign,
  MessageCircle,
  Instagram,
  Facebook,
  Globe,
  Clock,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';


interface LeadsKanbanProps {
  productId: string;
  productName: string;
  organizationId: string;
  onWhatsApp?: (phone: string, leadId: string, leadName: string) => void;
}

export function LeadsKanban({ productId, productName, organizationId, onWhatsApp }: LeadsKanbanProps) {
  const { user, profile } = useAuth();
  const { data: leads, isLoading: leadsLoading } = useLeads(productId);
  const { data: stages, isLoading: stagesLoading } = usePipelineStages(productId);
  const moveLead = useMoveLead();
  const createLead = useCreateLead();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', company: '', email: '', phone: '' });
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  
  // Deal modal state
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [selectedLeadForDeal, setSelectedLeadForDeal] = useState<{ id: string; name: string } | null>(null);
  
  // Lead detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const isLoading = leadsLoading || stagesLoading;

  const filteredLeads = leads?.filter(lead => 
    searchQuery === '' ||
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getLeadsByStage = (stageId: string) => 
    filteredLeads.filter(lead => lead.current_stage_id === stageId);

  const getStageTotal = (stageId: string) => {
    return getLeadsByStage(stageId).reduce((sum, lead) => sum + (lead.deal_value || 0), 0);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatCardCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getTemperatureIcon = (temp: string | null) => {
    switch (temp) {
      case 'hot': return <Flame size={14} className="text-destructive" />;
      case 'warm': return <ThermometerSun size={14} className="text-warning" />;
      case 'cold': return <Snowflake size={14} className="text-blue-400" />;
      default: return null;
    }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, stageId: string, stage: typeof stages[0]) => {
    e.preventDefault();
    if (!draggedLeadId) return;

    // Check if dropping into a "won" stage
    if (stage.is_won) {
      const lead = leads?.find(l => l.id === draggedLeadId);
      if (lead) {
        setSelectedLeadForDeal({ id: lead.id, name: lead.name });
        setDealModalOpen(true);
      }
    }

    try {
      await moveLead.mutateAsync({ leadId: draggedLeadId, stageId });
      if (!stage.is_won) {
        toast.success('Lead movido com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao mover lead');
    }
    setDraggedLeadId(null);
  };

  const handleAddLead = async () => {
    if (!newLead.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      await createLead.mutateAsync({
        name: newLead.name,
        company: newLead.company || null,
        email: newLead.email || null,
        phone: newLead.phone || null,
        product_id: productId,
        assigned_to: user?.id,
        organization_id: profile?.organization_id || '',
        current_stage_id: stages?.[0]?.id || null
      });
      toast.success('Lead adicionado!');
      setNewLead({ name: '', company: '', email: '', phone: '' });
      setIsAddingLead(false);
    } catch (error) {
      toast.error('Erro ao criar lead');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no stages, show setup message
  if (!stages?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <Calendar size={32} className="text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Pipeline não configurado
        </h3>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          Este produto ainda não possui etapas de funil configuradas.
          Um administrador precisa configurar o pipeline primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Squad Queue Banner */}
      <SquadQueueBanner productId={productId} />

      {/* Header: busca + ação */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Dialog open={isAddingLead} onOpenChange={setIsAddingLead}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto sm:ml-auto">
              <Plus size={18} className="mr-2" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  placeholder="Nome do lead"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Empresa</label>
                <Input
                  placeholder="Nome da empresa"
                  value={newLead.company}
                  onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleAddLead}
                disabled={createLead.isPending}
              >
                {createLead.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Adicionar Lead'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>


      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-16rem)]">
        {stages.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id);
          
          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80 flex flex-col h-full"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id, stage)}
            >
              {/* Column Header */}
              <div 
                className="p-4 rounded-t-xl text-white flex-shrink-0"
                style={{ 
                  background: `linear-gradient(135deg, ${stage.color || '#6b7280'}, ${stage.color || '#6b7280'}cc)` 
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm uppercase tracking-wide">{stage.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-white/20 text-white border-0 text-xs">
                      {stageLeads.length}
                    </Badge>
                    {stage.is_won && (
                      <span className="text-sm">🎉</span>
                    )}
                  </div>
                </div>
                <div className="text-xl font-bold">
                  {formatCurrency(getStageTotal(stage.id))}
                </div>
              </div>

              {/* Column Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-2 rounded-b-xl border border-border bg-secondary/30 space-y-2">
                {stageLeads.map((lead) => {
                  const bantScore = computeBantScore(lead as any);
                  const bantTier = getBantTier(bantScore);
                  const owner = (lead as any).closer || (lead as any).sdr || (lead as any).assignee;
                  const ownerRole = (lead as any).closer ? 'Closer' : (lead as any).sdr ? 'SDR' : 'Responsável';

                  return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className={cn(
                      "p-3 rounded-lg border border-border bg-card cursor-grab group",
                      "hover:border-primary/50 hover:shadow-md transition-all",
                      "active:cursor-grabbing",
                      draggedLeadId === lead.id && "opacity-50"
                    )}
                  >
                    {/* Top row: drag + temperature + actions */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GripVertical size={14} className="text-muted-foreground flex-shrink-0" />
                        <h4 
                          className="font-medium text-sm text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setDetailModalOpen(true);
                          }}
                        >
                          {lead.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {getTemperatureIcon(lead.temperature)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeadId(lead.id);
                            setDetailModalOpen(true);
                          }}
                        >
                          <Eye size={12} />
                        </Button>
                      </div>
                    </div>

                    {/* Company */}
                    {lead.company && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Building size={11} />
                        <span className="truncate">{lead.company}</span>
                      </div>
                    )}

                    {/* BANT + last contact line */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-5 px-1.5 text-[10px] font-semibold gap-1 border",
                                bantTier === 'high' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                                bantTier === 'good' && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                                bantTier === 'partial' && "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
                                bantTier === 'low' && "bg-destructive/10 text-destructive border-destructive/30"
                              )}
                            >
                              <Target size={10} />
                              BANT {bantScore}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Qualificação BANT: {bantScore}/100</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {lead.last_contact_at && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {getChannelIcon(lead.lead_channel)}
                          <Clock size={10} />
                          <span>
                            {formatDistanceToNow(new Date(lead.last_contact_at), { locale: ptBR, addSuffix: false })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer: deal value + owner */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      {lead.deal_value && lead.deal_value > 0 ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-xs font-semibold">
                            {formatCardCurrency(lead.deal_value)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Sem valor</span>
                      )}

                      {owner ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="h-6 w-6 border border-border">
                                <AvatarImage src={owner.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {(owner.full_name || '?').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              {ownerRole}: {owner.full_name || 'Sem nome'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Sem dono</span>
                      )}
                    </div>

                    {lead.cadence_day && lead.cadence_day > 1 && (
                      <Badge variant="outline" className="mt-2 text-[10px] h-4 px-1.5 bg-primary/5 border-primary/20 text-primary">
                        Cadência D{lead.cadence_day}
                      </Badge>
                    )}
                  </div>
                  );
                })}

                {stageLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <User size={24} className="mb-2 opacity-50" />
                    <p className="text-sm">Nenhum lead</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Modal */}
      {selectedLeadForDeal && (
        <DealModal
          isOpen={dealModalOpen}
          onClose={() => {
            setDealModalOpen(false);
            setSelectedLeadForDeal(null);
          }}
          leadId={selectedLeadForDeal.id}
          leadName={selectedLeadForDeal.name}
          productId={productId}
          organizationId={organizationId}
        />
      )}

      {/* Lead Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden p-0">
          <VisuallyHidden>
            <DialogTitle>Detalhes do Lead</DialogTitle>
          </VisuallyHidden>
          {selectedLeadId && (
            <LeadDetailPage
              leadId={selectedLeadId}
              onBack={() => {
                setDetailModalOpen(false);
                setSelectedLeadId(null);
              }}
              isAdminView={false}
              onWhatsApp={onWhatsApp}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
