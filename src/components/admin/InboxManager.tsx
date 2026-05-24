import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, BarChart3 } from 'lucide-react';
import { WebChatInbox } from './webchat/WebChatInbox';
import { WebChatReportsTab } from './webchat/WebChatReportsTab';

export function InboxManager() {
  const [activeTab, setActiveTab] = useState('inbox');

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 mb-3">
        <h1 className="text-2xl font-bold">Atendimentos</h1>
        <p className="text-sm text-muted-foreground">
          Central de conversas do chat do site
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 min-h-0 flex flex-col"
      >
        <TabsList className="flex-shrink-0 grid w-full grid-cols-2 lg:w-auto lg:inline-grid mb-3">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>Inbox</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span>Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="flex-1 min-h-0 overflow-hidden mt-0">
          <WebChatInbox />
        </TabsContent>

        <TabsContent value="reports" className="flex-1 min-h-0 overflow-auto mt-0">
          <WebChatReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
