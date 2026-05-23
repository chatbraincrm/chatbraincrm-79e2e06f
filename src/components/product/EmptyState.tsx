import { Clock, LayoutDashboard, PackagePlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import { usePlatformName } from '@/hooks/usePlatformName';
import { useAuth } from '@/hooks/useAuth';

export function EmptyState() {
  const { platformName } = usePlatformName();
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const isAdminLike = isAdmin() || isSuperAdmin();

  if (isAdminLike) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="relative mb-8">
          <div className="h-24 w-24 rounded-2xl bg-muted/50 flex items-center justify-center p-4">
            <Logo size="lg" showText={false} />
          </div>
          <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-foreground mb-2 text-center">
          Nenhum produto atribuído a você
        </h2>

        <p className="text-muted-foreground text-center max-w-md mb-8 text-sm">
          Você é administrador desta empresa. Crie um produto ou atribua produtos
          existentes a si mesmo para usar o app de vendedor.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <Button
            className="flex-1"
            onClick={() => navigate('/admin')}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Ir para o Painel Admin
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/admin')}
          >
            <PackagePlus className="h-4 w-4 mr-2" />
            Criar produto
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/admin')}
          >
            <Users className="h-4 w-4 mr-2" />
            Gerenciar equipe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="relative mb-8">
        <div className="h-24 w-24 rounded-2xl bg-muted/50 flex items-center justify-center p-4">
          <Logo size="lg" showText={false} />
        </div>
        <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background">
          <Clock className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-2 text-center">
        Bem-vindo ao {platformName}
      </h2>

      <p className="text-base text-muted-foreground text-center mb-2">
        Você ainda não tem produtos atribuídos
      </p>

      <p className="text-muted-foreground text-center max-w-md mb-8 text-sm">
        Aguarde seu gestor liberar acesso aos produtos. Assim que isso acontecer,
        você verá aqui tudo o que precisa para vender.
      </p>

      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-muted-foreground text-sm">
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        Aguardando liberação
      </div>
    </div>
  );
}
