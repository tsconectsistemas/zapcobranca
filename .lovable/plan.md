## Plano de Refatoração e Otimização - ZapCobrança

Este plano visa estabilizar o sistema, corrigir falhas de segurança e melhorar a performance e manutenção do código em 4 etapas lógicas.

### Etapa 1: Estabilidade e Infraestrutura (Imediato)
*   **Correção de Erros de Servidor (SSR):** Ajustar o `vite.config.ts` para resolver o conflito de dependências do TanStack Start (`h3-v2`), garantindo que o ambiente de produção/preview carregue corretamente.
*   **Saneamento do Banco de Dados:** Resolver os alertas de segurança identificados pelo linter do Supabase.
    *   Definir `search_path` em todas as funções SQL para evitar ataques de sequestro de caminho.
    *   Restringir funções `SECURITY DEFINER` que estão expostas publicamente sem necessidade.
*   **Validação de Ambiente:** Implementar verificações de integridade para as chaves de API do Supabase no lado do servidor.

### Etapa 2: UI/UX e Consistência Visual
*   **Padronização da Logo:** Refatorar o componente `Logo.tsx` para garantir que o raio e o texto sejam brancos estritamente no contexto do painel administrativo (`/admin`) e mantenham as cores da marca (verde) no painel da revenda e páginas públicas.
*   **Biblioteca de Componentes Local:** Extrair padrões repetidos de Modals (clientes, cobranças), Badges de status e PageHeaders para componentes compartilhados, reduzindo a duplicidade de código em `src/components`.
*   **Otimização Mobile:** Revisar as rotas administrativas que atualmente possuem bloqueio para mobile, permitindo acesso básico de monitoramento.

### Etapa 3: Performance e Tempo Real
*   **Supabase Realtime:** Substituir o `setInterval` usado para verificar o status do WhatsApp no `AppShell.tsx` por uma inscrição via Realtime, reduzindo requisições desnecessárias.
*   **Migração TanStack Query:** Converter carregamentos de dados manuais (`useEffect`) remanescentes para `useQuery`.
*   **Indexação Estratégica:** Adicionar índices nas colunas `tenant_id` e `user_id` em todas as tabelas para acelerar filtros de RLS.

### Etapa 4: Manutenção e Escalabilidade
*   **Consolidação de Migrações:** Organizar o histórico de migrações do Supabase para reduzir a complexidade do esquema.
*   **Tipagem Estrita:** Gerar e integrar tipos TypeScript completos para todas as tabelas e funções do Supabase.
*   **Monitoramento de Erros:** Configurar um sistema de captura de logs de erro (Error Boundary) que reporte falhas críticas para o banco de dados.

---

### Detalhes Técnicos
*   **SSR FIX:** Adicionaremos um alias global no Vite e marcaremos `h3` como `noExternal` para garantir que o bundle do servidor inclua a dependência corretamente.
*   **DB Security:** O foco será fechar as brechas de segurança no schema `public` seguindo as melhores práticas do Supabase.
